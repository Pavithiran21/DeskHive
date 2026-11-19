const { randomBytes } = require('node:crypto');
const { expect } = require('@playwright/test');
const { ADMINS } = require('./pool');

// A small API client over Playwright's request context. Calls carry X-Test-Now, so "today", the
// 14-day booking window and the check-in window are the same on every day the suite runs
// (TIME_OVERRIDE_ENABLED=true in .env.test; production refuses it).
//
// Every test makes its own office (unique name) with its own floor and spaces, so no two tests ever
// book the same desk.

// Wednesday 18 Nov 2026, 09:00 in Kolkata (03:30 UTC). TOMORROW is inside the booking window.
const NOW = '2026-11-18T03:30:00Z';
const TODAY = '2026-11-18';
const TOMORROW = '2026-11-19';

function apiUrl(pathname) {
  return `${process.env.E2E_API_URL}${pathname}`;
}

function client(request, token, now = NOW) {
  const headers = { 'X-Test-Now': now, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const call = (method) => (pathname, data, extra = {}) =>
    request.fetch(apiUrl(pathname), { method, headers: { ...headers, ...extra }, ...(data === undefined ? {} : { data }) });
  const api = { get: call('GET'), post: call('POST'), put: call('PUT'), patch: call('PATCH'), delete: call('DELETE'), token };
  /** The same client "as if it were" another moment. */
  api.at = (moment) => client(request, token, moment);
  return api;
}

/** The JSON body of a response that must have the given status. */
async function json(response, status) {
  const text = await response.text();
  expect(response.status(), text.slice(0, 500)).toBe(status);
  return text ? JSON.parse(text) : null;
}

/** Logs in at the real time: access tokens are always checked against the real clock (TestTimeFilter). */
async function loginAs(request, email, password = process.env.E2E_PASSWORD) {
  const response = await request.post(apiUrl('/auth/login'), { data: { email, password } });
  const body = await json(response, 200);
  return client(request, body.accessToken);
}

const admin = (request, which = 0) => loginAs(request, ADMINS[which]);

/** A new office in Kolkata (08:00–19:00) with one floor, `desks` desks in row A and optionally a room. */
async function newOffice(request, { desks = 3, room = false, timeZone = 'Asia/Kolkata' } = {}) {
  const api = await admin(request);
  const name = `Office ${randomBytes(4).toString('hex')}`;
  const office = await json(await api.post('/admin/offices', { name, address: '1 Test Road', timeZone }), 201);
  const floor = await json(await api.post('/admin/floors', { officeId: office.id, name: 'Floor 1' }), 201);
  const deskList = [];
  for (let number = 1; number <= desks; number += 1) {
    deskList.push(await json(await api.post('/admin/desks', { floorId: floor.id, area: 'Open plan', row: 'A', number, features: [] }), 201));
  }
  const roomSpace = room ? await json(await api.post('/admin/rooms', { floorId: floor.id, name: `Room ${name.slice(-4)}`, capacity: 6, features: [] }), 201) : null;
  return { admin: api, office, floor, desks: deskList, room: roomSpace };
}

function book(api, spaceId, { date = TOMORROW, startTime = '10:00', endTime = '12:00' } = {}) {
  return api.post('/bookings', { spaceId, date, startTime, endTime });
}

module.exports = { NOW, TODAY, TOMORROW, apiUrl, client, json, loginAs, admin, newOffice, book };
