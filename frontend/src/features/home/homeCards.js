import { formatRange, formatTime, toMinutes } from '../../lib/time';
import { featureInfo } from '../../lib/features';

// The category row: features only (a quiet zone is an area name, not a feature, so it has no chip).
export const CATEGORIES = [
  { id: 'ALL', label: 'All spaces' },
  { id: 'WINDOW', label: 'By the window' },
  { id: 'DUAL_MONITOR', label: 'Dual monitor' },
  { id: 'STANDING', label: 'Standing' },
  { id: 'ROOMS', label: 'Meeting rooms' },
  { id: 'ACCESSIBLE', label: 'Accessible' },
];

/**
 * The cards for the chosen category, from one availability answer. With a feature chip on, a desk
 * area shows its count for that feature (freeWithFeature) and an area with none of it is hidden;
 * Accessible also keeps the step-free rooms.
 */
export function cardsFor(availability, { category, floorId }) {
  const onFloor = (item) => floorId === 'all' || String(item.floorId) === String(floorId);
  let desks = availability.deskAreas.filter(onFloor);
  let rooms = availability.rooms.filter(onFloor);

  if (category === 'ROOMS') {
    desks = [];
  } else if (category !== 'ALL') {
    desks = desks.filter((area) => (area.freeWithFeature[category] ?? 0) > 0);
    rooms = category === 'ACCESSIBLE' ? rooms.filter((room) => room.features.includes('STEP_FREE')) : [];
  }
  return { desks, rooms };
}

/** "4 window desks free" for a chip, "14 of 50 desks free" otherwise. */
export function deskFreeText(area, category) {
  if (category !== 'ALL' && category !== 'ROOMS') {
    const count = area.freeWithFeature[category] ?? 0;
    const word = { WINDOW: 'window', DUAL_MONITOR: 'dual-monitor', STANDING: 'standing', ACCESSIBLE: 'accessible' }[category];
    return `${count} ${word} ${count === 1 ? 'desk' : 'desks'} free`;
  }
  if (area.free === 0) {
    return 'Fully booked';
  }
  return `${area.free} of ${area.total} desks free`;
}

/** The features a desk area's free desks have, as "dual monitors"-style words for the card line. */
export function deskFeatureLine(area) {
  const words = Object.keys(area.freeWithFeature)
    .filter((code) => code !== 'ACCESSIBLE')
    .map((code) => featureInfo(code).label.toLowerCase());
  return [area.floor, ...words].join(' · ');
}

/**
 * A room's free times as the card says them: "Free all day", "Fully booked", or
 * "Free 10:30 am – 2:00 pm" with the rest after it ("and after 3:30 pm").
 */
export function roomFreeText(room, rules) {
  const times = room.freeTimes;
  if (!times.length) {
    return { lead: 'Fully booked', rest: '' };
  }
  if (
    times.length === 1 &&
    toMinutes(times[0].from) <= toMinutes(rules.opensAt) &&
    toMinutes(times[0].to) >= toMinutes(rules.closesAt)
  ) {
    return { lead: 'Free all day', rest: '' };
  }
  // A free time that runs to closing is "after 3:30 pm"; any other is "10:30 am – 2:00 pm".
  const describe = (time) =>
    toMinutes(time.to) >= toMinutes(rules.closesAt) ? `after ${formatTime(time.from)}` : formatRange(time.from, time.to);
  const [first, ...others] = times;
  const lead = `Free ${describe(first)}`;
  const rest = others.length ? `and ${others.map(describe).join(', ')}` : '';
  return { lead, rest };
}
