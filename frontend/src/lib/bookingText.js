import { formatDay, formatRange, todayIn } from './time';

/** "Seat B8 · Quiet zone" for a desk, "Hive room" for a room. */
export function spaceTitle(space) {
  if (space.type === 'DESK') {
    return space.area ? `Seat ${space.label} · ${space.area}` : `Seat ${space.label}`;
  }
  return space.label;
}

/** "Seat B8" or "Hive room" (no area), for buttons and dialogs. */
export function spaceShort(space) {
  return space.type === 'DESK' ? `Seat ${space.label}` : space.label;
}

/** "Today, 9:00 am – 5:00 pm" or "Tue 20 Oct, 9:00 am – 5:00 pm" */
export function whenText(booking) {
  const today = todayIn(booking.timeZone);
  const day = booking.date === today ? 'Today' : formatDay(booking.date);
  return `${day}, ${formatRange(booking.startTime, booking.endTime)}`;
}

/**
 * The tag on a booking row and the booking view. It only describes the booking: which buttons show is
 * decided by booking.actions from the API, never worked out here.
 */
export function bookingTag(booking) {
  switch (booking.status) {
    case 'CHECKED_IN':
      return { text: 'Checked in', tone: 't-gray' };
    case 'AUTO_RELEASED':
      return { text: 'Auto-released', tone: 't-err' };
    case 'CANCELLED':
      return booking.cancellation?.byAdmin
        ? { text: 'Cancelled by admin', tone: 't-warn' }
        : { text: 'Cancelled', tone: 't-gray' };
    default:
      break;
  }
  if (booking.ended) {
    return { text: 'Ended', tone: 't-gray' };
  }
  if (booking.actions?.canCheckIn) {
    return { text: `Check in by ${booking.checkIn.closesAtLocal}`, tone: 't-rose' };
  }
  if (booking.date === todayIn(booking.timeZone)) {
    return { text: `Check in from ${booking.checkIn.opensAtLocal}`, tone: 't-rose' };
  }
  return { text: 'Confirmed', tone: 't-free' };
}

export const PEOPLE_STATUS = {
  ACTIVE: { text: 'Active', tone: 't-free' },
  INVITE_PENDING: { text: 'Invite pending', tone: 't-warn' },
  INVITE_EXPIRED: { text: 'Invite expired', tone: 't-gray' },
  REMOVED: { text: 'Removed', tone: 't-gray' },
};

/** lockedReason is a code; the words live here (UI-UX.md, People and invites). */
export const LOCKED_REASON_TEXT = {
  SEED_ONLY: 'Seed script only',
  DEMO: "Demo accounts can't be removed.",
};

/** Status filter on All bookings: the API's statuses with their words. */
export const BOOKING_STATUSES = [
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'CHECKED_IN', label: 'Checked in' },
  { value: 'AUTO_RELEASED', label: 'Auto-released' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

/** "Priya Raman" -> "PR" */
export function initials(name) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return '?';
  }
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** "Priya Raman" -> "Priya" (dialogs and toasts). */
export function firstName(name) {
  return (name ?? '').trim().split(/\s+/)[0] || name;
}
