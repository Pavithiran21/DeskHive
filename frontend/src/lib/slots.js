import { formatRange, nowMinutesIn, todayIn, toMinutes } from './time';

// The time choices on Home, the desk page and Change booking. Custom moves in 30-minute steps.
export const SLOTS = [
  { id: 'morning', label: 'Morning', from: '09:00', to: '13:00' },
  { id: 'afternoon', label: 'Afternoon', from: '13:00', to: '17:00' },
  { id: 'full', label: 'Full day', from: '09:00', to: '17:00' },
];

export const DEFAULT_SLOT = 'full';

/** The from/to of a slot id, or the custom times. */
export function slotTimes(slot, customFrom, customTo) {
  const preset = SLOTS.find((entry) => entry.id === slot);
  if (preset) {
    return { from: preset.from, to: preset.to };
  }
  return { from: customFrom ?? '09:00', to: customTo ?? '17:00' };
}

/** "Full day" or "10:00 am – 2:00 pm" for the pill and the reserve card. */
export function slotLabel(slot, from, to) {
  const preset = SLOTS.find((entry) => entry.id === slot);
  return preset ? preset.label : formatRange(from, to);
}

/** The slot id that matches two times, or 'custom'. */
export function slotIdFor(from, to) {
  const match = SLOTS.find((entry) => entry.from === from && entry.to === to);
  return match ? match.id : 'custom';
}

/**
 * Why a time can't be picked, or null. The server checks the same rules again (422); this only greys
 * out chips that would be refused anyway: outside opening hours, longer than the longest booking,
 * or already started today in the office's zone.
 */
export function timeProblem({ date, from, to, office }) {
  if (!office) {
    return null;
  }
  const rules = office.rules;
  if (toMinutes(from) < toMinutes(rules.opensAt) || toMinutes(to) > toMinutes(rules.closesAt)) {
    return 'hours';
  }
  if (toMinutes(to) - toMinutes(from) > rules.maxBookingHours * 60) {
    return 'long';
  }
  if (date === todayIn(office.timeZone) && toMinutes(from) <= nowMinutesIn(office.timeZone)) {
    return 'started';
  }
  return null;
}
