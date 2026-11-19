import { apiRequest, toQuery } from './client';

/** Offices with their rules and floors (both roles). */
export function getOffices() {
  return apiRequest('/offices');
}

/** Home cards: desk areas with free counts (and freeWithFeature) plus rooms with their free times. */
export function getAvailability({ officeId, date, from, to }) {
  return apiRequest(`/availability${toQuery({ officeId, date, from, to })}`);
}

/** seats [{ id, label, area, row, number, features, state: FREE|BOOKED|MINE, myBookingId }] */
export function getSeatMap(floorId, { area, date, from, to }) {
  return apiRequest(`/floors/${floorId}/seat-map${toQuery({ area, date, from, to })}`);
}

/** A room's day: opening hours, maxBookingMinutes and blocks [{ from, to, mine, bookingId }]. */
export function getRoomDay(roomId, date) {
  return apiRequest(`/rooms/${roomId}${toQuery({ date })}`);
}
