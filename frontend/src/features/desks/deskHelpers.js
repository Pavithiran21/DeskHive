import { IconArrowAutofitHeight, IconDeviceDesktop, IconWheelchair, IconWindow } from '@tabler/icons-react';
import { formatTime, fromMinutes, toMinutes } from '../../lib/time';

/** The office a floor belongs to, from the cached office list (it carries the rules and the zone). */
export function officeOfFloor(offices, floorId) {
  return offices?.find((office) => office.floors.some((floor) => String(floor.id) === String(floorId))) ?? null;
}

/** "Dual monitors in rows A–C" style facts from the seats themselves. */
export function seatFacts(seats) {
  const facts = [];
  const rowsWith = (code) => [...new Set(seats.filter((seat) => seat.features.includes(code)).map((seat) => seat.row))].sort();
  const rowText = (rows) => (rows.length === 1 ? `row ${rows[0]}` : `rows ${rows[0]}–${rows[rows.length - 1]}`);
  const dual = rowsWith('DUAL_MONITOR');
  if (dual.length) facts.push({ Icon: IconDeviceDesktop, text: `Dual monitors in ${rowText(dual)}` });
  const windowRows = rowsWith('WINDOW');
  if (windowRows.length) facts.push({ Icon: IconWindow, text: `Window seats in ${rowText(windowRows)}` });
  const standing = seats.filter((seat) => seat.features.includes('STANDING')).length;
  if (standing) facts.push({ Icon: IconArrowAutofitHeight, text: `${standing} standing ${standing === 1 ? 'desk' : 'desks'}` });
  const accessible = seats.filter((seat) => seat.features.includes('ACCESSIBLE')).length;
  if (accessible) facts.push({ Icon: IconWheelchair, text: `${accessible} accessible ${accessible === 1 ? 'desk' : 'desks'}` });
  return facts;
}

/** "Check in from 8:45 am. If you haven't checked in by 9:15 am, ..." from the start time. */
export function checkInNote(from) {
  const opens = formatTime(fromMinutes(toMinutes(from) - 15));
  const closes = formatTime(fromMinutes(toMinutes(from) + 15));
  return `Check in from ${opens}. If you haven't checked in by ${closes}, the seat is released and we email you.`;
}

