const { test, expect } = require('@playwright/test');
const { TOMORROW, book, json, loginAs, newOffice } = require('../../helpers/api');
const { claimEmployee, claimEmployees } = require('../../helpers/pool');

// The signature feature: many people clicking "Book" on the same desk at the same moment get exactly
// one confirmed booking (row locks on the user and the space, then the overlap check, under READ
// COMMITTED), and the booking rules hold under parallel requests too.

test.describe('no double booking under concurrency', () => {
  test('20 people book the same desk and slot at once: exactly one 201, nineteen 409 SPACE_TAKEN', async ({ request }) => {
    const { desks } = await newOffice(request, { desks: 1 });
    const people = await Promise.all(claimEmployees(20).map((email) => loginAs(request, email)));

    const responses = await Promise.all(people.map((api) => book(api, desks[0].id)));
    const statuses = responses.map((response) => response.status());
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(19);
    const losers = await Promise.all(responses.filter((r) => r.status() === 409).map((r) => r.json()));
    expect(new Set(losers.map((body) => body.error.code))).toEqual(new Set(['SPACE_TAKEN']));
  });

  test('one person sends five bookings for five desks on one day at once: one desk a day still holds', async ({ request }) => {
    const { desks } = await newOffice(request, { desks: 5 });
    const api = await loginAs(request, claimEmployee());

    const responses = await Promise.all(desks.map((desk) => book(api, desk.id)));
    const statuses = responses.map((response) => response.status()).sort();
    expect(statuses).toEqual([201, 422, 422, 422, 422]);
    const refused = await Promise.all(responses.filter((r) => r.status() === 422).map((r) => r.json()));
    expect(refused.every((body) => body.error.code === 'ONE_DESK_PER_DAY')).toBe(true);
  });

  test('a room can be booked by two people back to back, but not overlapping (409 ROOM_OVERLAP)', async ({ request }) => {
    const { room } = await newOffice(request, { desks: 0, room: true });
    const [first, second, third] = await Promise.all(claimEmployees(3).map((email) => loginAs(request, email)));

    await json(await book(first, room.id, { startTime: '10:00', endTime: '11:00' }), 201);
    await json(await book(second, room.id, { startTime: '11:00', endTime: '12:00' }), 201);
    expect((await json(await book(third, room.id, { startTime: '10:30', endTime: '11:30' }), 409)).error.code).toBe('ROOM_OVERLAP');
  });
});

test.describe('booking rules (per office)', () => {
  test('outside opening hours, too far ahead and too long are refused with 422 and a reason', async ({ request }) => {
    const { desks } = await newOffice(request, { desks: 1 });
    const api = await loginAs(request, claimEmployee());
    const code = async (options) => (await json(await book(api, desks[0].id, options), 422)).error.code;

    expect(await code({ startTime: '07:00', endTime: '09:00' })).toBe('OUTSIDE_OPENING_HOURS');
    expect(await code({ date: '2026-12-10' })).toBe('TOO_FAR_AHEAD');
    expect(await code({ startTime: '09:00', endTime: '18:00' })).toBe('TOO_LONG');
  });

  test('times follow the office\'s own time zone: 09:00 in London is 09:00 UTC in November', async ({ request }) => {
    const { desks } = await newOffice(request, { desks: 1, timeZone: 'Europe/London' });
    const api = await loginAs(request, claimEmployee());
    const booking = await json(await book(api, desks[0].id, { startTime: '09:00', endTime: '10:00' }), 201);
    expect(booking.startAt).toBe(`${TOMORROW}T09:00:00Z`);
    expect(booking.timeZone).toBe('Europe/London');
  });
});

test.describe('check-in and access', () => {
  test('check-in opens 15 minutes before the start', async ({ request }) => {
    const { desks } = await newOffice(request, { desks: 1 });
    const api = await loginAs(request, claimEmployee());
    // Tomorrow 10:00 in Kolkata is 04:30 UTC.
    const booking = await json(await book(api, desks[0].id), 201);

    const early = await api.at(`${TOMORROW}T04:00:00Z`).post(`/bookings/${booking.id}/check-in`);
    expect((await json(early, 422)).error.code).toBe('CHECK_IN_NOT_OPEN');
    const checkedIn = await json(await api.at(`${TOMORROW}T04:20:00Z`).post(`/bookings/${booking.id}/check-in`), 200);
    expect(checkedIn.status).toBe('CHECKED_IN');
  });

  test('an Employee is refused the admin API (403) and another person\'s booking answers 404', async ({ request }) => {
    const { desks } = await newOffice(request, { desks: 1 });
    const [owner, stranger] = await Promise.all(claimEmployees(2).map((email) => loginAs(request, email)));
    const booking = await json(await book(owner, desks[0].id), 201);

    expect((await stranger.post('/admin/offices', { name: 'Nope', address: 'x', timeZone: 'Asia/Kolkata' })).status()).toBe(403);
    expect((await stranger.get(`/bookings/${booking.id}`)).status()).toBe(404);
    expect((await stranger.post(`/bookings/${booking.id}/cancel`, {})).status()).toBe(404);
  });

  test('log in: a wrong password is 401, and the API needs a token', async ({ request }) => {
    const email = claimEmployee();
    const wrong = await request.post(`${process.env.E2E_API_URL}/auth/login`, { data: { email, password: 'Not-the-password-1' } });
    expect(wrong.status()).toBe(401);
    expect((await request.get(`${process.env.E2E_API_URL}/bookings`)).status()).toBe(401);
  });
});
