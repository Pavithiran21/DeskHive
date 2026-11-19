import { fromMinutes, halfHourSteps, nowMinutesIn, todayIn, toMinutes } from './time';

/**
 * The first free hour (or half hour) of a room's day that hasn't started yet, as { from, to } "HH:mm",
 * or null when nothing is free. Used to pre-fill the From / To selects.
 */
export function firstFreePick(day, timeZone, ignoreBookingId) {
  const now = day.date === todayIn(timeZone) ? nowMinutesIn(timeZone) : -1;
  const busy = day.blocks.filter((block) => block.bookingId !== ignoreBookingId);
  const free = (from, to) => !busy.some((block) => toMinutes(block.from) < to && toMinutes(block.to) > from);
  for (const step of halfHourSteps(day.opensAt, day.closesAt).slice(0, -1)) {
    const start = toMinutes(step);
    if (start <= now) continue;
    for (const length of [60, 30]) {
      const end = start + length;
      if (end <= toMinutes(day.closesAt) && free(start, end)) {
        return { from: fromMinutes(start), to: fromMinutes(end) };
      }
    }
  }
  return null;
}
