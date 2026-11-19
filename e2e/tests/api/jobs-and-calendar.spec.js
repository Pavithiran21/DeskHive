const { test, expect } = require('@playwright/test');
const { TODAY, TOMORROW, apiUrl, book, json, loginAs, newOffice } = require('../../helpers/api');
const { waitForMail } = require('../../helpers/mail');
const { claimEmployee } = require('../../helpers/pool');

// Auto-release (exactly once, never on a checked-in booking) and the .ics calendar file attached to
// the booking emails, read back from the run's real Ethereal inbox.

test.describe.configure({ timeout: 90_000 });

/** The .ics attachment of a mail, parsed into its property lines ("SEQUENCE" -> "12"). */
function calendarOf(mail) {
  const attachment = mail.attachments.find((file) => file.contentType.startsWith('text/calendar'));
  expect(attachment, 'a text/calendar attachment').toBeTruthy();
  const text = attachment.content.toString('utf8').replace(/\r\n /g, '');
  const props = Object.fromEntries(
    text.split('\r\n').filter(Boolean).map((line) => {
      const colon = line.indexOf(':');
      return [line.slice(0, colon).split(';')[0], line.slice(colon + 1)];
    }),
  );
  // mailparser's contentType is the bare type; the method= parameter is in the raw header.
  const method = attachment.headers.get('content-type')?.params?.method;
  return { text, props, method };
}

const utc = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d+/, '');

function runJob(request, job, at) {
  return request.post(apiUrl(`/internal/jobs/${job}`), { data: { at }, headers: { 'X-Job-Secret': process.env.JOB_TRIGGER_SECRET } });
}

test('the confirmation email carries an .ics that adds the event; a change sends the same UID with a higher SEQUENCE', async ({ request }) => {
  const { desks } = await newOffice(request, { desks: 1 });
  const email = claimEmployee();
  const api = await loginAs(request, email);
  const booking = await json(await book(api, desks[0].id, { startTime: '10:00', endTime: '12:00' }), 201);

  const first = calendarOf(await waitForMail({ to: email, subject: /^You're booked/ }));
  expect(first.method).toBe('REQUEST');
  expect(first.props).toMatchObject({
    METHOD: 'REQUEST',
    UID: `booking-${booking.id}@deskhive`,
    DTSTART: utc(booking.startAt),
    DTEND: utc(booking.endAt),
    STATUS: 'CONFIRMED',
  });
  expect(first.props.ATTENDEE).toBe(`mailto:${email}`);

  // Seconds have to pass for SEQUENCE (seconds since the booking was made) to grow.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const changed = await json(await api.patch(`/bookings/${booking.id}`, { date: TOMORROW, startTime: '13:00', endTime: '15:00' }), 200);
  const second = calendarOf(await waitForMail({ to: email, subject: /^Booking changed/ }));
  expect(second.props.UID).toBe(first.props.UID);
  expect(second.props.DTSTART).toBe(utc(changed.startAt));
  expect(Number(second.props.SEQUENCE)).toBeGreaterThan(Number(first.props.SEQUENCE));
});

test('an Admin cancels a booking: the employee\'s email has a CANCEL .ics for the same event', async ({ request }) => {
  const { admin, desks } = await newOffice(request, { desks: 1 });
  const email = claimEmployee();
  const booking = await json(await book(await loginAs(request, email), desks[0].id), 201);

  const cancelled = await json(await admin.post(`/admin/bookings/${booking.id}/cancel`, { reason: 'Floor closed for cleaning' }), 200);
  expect(cancelled.status).toBe('CANCELLED');
  const mail = await waitForMail({ to: email, subject: /^Your booking was cancelled/ });
  expect(mail.text).toContain('Floor closed for cleaning');
  const ics = calendarOf(mail);
  expect(ics.method).toBe('CANCEL');
  expect(ics.props).toMatchObject({ METHOD: 'CANCEL', STATUS: 'CANCELLED', UID: `booking-${booking.id}@deskhive` });
});

test('auto-release: no check-in 15 minutes after the start releases the booking once; a checked-in one stays', async ({ request }) => {
  const { desks } = await newOffice(request, { desks: 2 });
  const [lateEmail, onTimeEmail] = [claimEmployee(), claimEmployee()];
  const late = await loginAs(request, lateEmail);
  const onTime = await loginAs(request, onTimeEmail);
  // Today 10:00–11:00 in Kolkata = 04:30–05:30 UTC. Other tests book tomorrow, so this run touches only these.
  const lateBooking = await json(await book(late, desks[0].id, { date: TODAY, startTime: '10:00', endTime: '11:00' }), 201);
  const onTimeBooking = await json(await book(onTime, desks[1].id, { date: TODAY, startTime: '10:00', endTime: '11:00' }), 201);
  await json(await onTime.at(`${TODAY}T04:35:00Z`).post(`/bookings/${onTimeBooking.id}/check-in`), 200);

  expect((await request.post(apiUrl('/internal/jobs/release'), { data: { at: `${TODAY}T04:46:00Z` } })).status()).toBe(401);
  const first = await json(await runJob(request, 'release', `${TODAY}T04:46:00Z`), 200);
  expect(first.bookingsDone).toBeGreaterThanOrEqual(1);
  // Two more runs at the same moment, one of them in parallel: nothing is released twice.
  const again = await Promise.all([runJob(request, 'release', `${TODAY}T04:47:00Z`), runJob(request, 'release', `${TODAY}T04:47:00Z`)]);
  for (const response of again) expect(response.status()).toBe(200);

  expect((await json(await late.get(`/bookings/${lateBooking.id}`), 200)).status).toBe('AUTO_RELEASED');
  expect((await json(await onTime.get(`/bookings/${onTimeBooking.id}`), 200)).status).toBe('CHECKED_IN');

  const mail = await waitForMail({ to: lateEmail, subject: /was released$/ });
  expect(calendarOf(mail).props).toMatchObject({ METHOD: 'CANCEL', UID: `booking-${lateBooking.id}@deskhive` });
});
