import { apiRequest, toQuery } from './client';

/** Times are the office's local date and HH:mm, never UTC instants. */
export function createBooking({ spaceId, date, startTime, endTime }) {
  return apiRequest('/bookings', { method: 'POST', body: { spaceId, date, startTime, endTime } });
}

export function listMyBookings({ tab, page, size = 20 }) {
  return apiRequest(`/bookings${toQuery({ tab, page, size })}`);
}

export function getBooking(id) {
  return apiRequest(`/bookings/${id}`);
}

/** One transaction on the server: a 409 changes nothing. */
export function changeBooking(id, { spaceId, date, startTime, endTime }) {
  return apiRequest(`/bookings/${id}`, { method: 'PATCH', body: { spaceId, date, startTime, endTime } });
}

export function cancelBooking(id) {
  return apiRequest(`/bookings/${id}/cancel`, { method: 'POST' });
}

export function checkIn(id) {
  return apiRequest(`/bookings/${id}/check-in`, { method: 'POST' });
}
