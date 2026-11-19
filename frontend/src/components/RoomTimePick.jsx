import { useId } from 'react';
import { formatTime, halfHourSteps, nowMinutesIn, todayIn, toMinutes } from '../lib/time';

/** True when [from, to) overlaps one of the blocks. */
function overlapsBooked(from, to, blocks) {
  return blocks.some((block) => toMinutes(block.from) < toMinutes(to) && toMinutes(block.to) > toMinutes(from));
}

/**
 * The room's From / To selects in 30-minute steps. Booked times, times that have started today and
 * picks longer than the longest booking are disabled; the server checks all of it again.
 */
export function RoomTimePick({ day, timeZone, value, onChange, ignoreBookingId }) {
  const fromId = useId();
  const toId = useId();
  const steps = halfHourSteps(day.opensAt, day.closesAt);
  const now = day.date === todayIn(timeZone) ? nowMinutesIn(timeZone) : -1;
  // The booking being changed doesn't block its own new time.
  const busy = day.blocks.filter((block) => block.bookingId !== ignoreBookingId);

  const fromDisabled = (step) =>
    toMinutes(step) <= now || busy.some((block) => toMinutes(block.from) <= toMinutes(step) && toMinutes(block.to) > toMinutes(step));
  const toDisabled = (step) =>
    toMinutes(step) <= toMinutes(value.from) ||
    toMinutes(step) - toMinutes(value.from) > day.maxBookingMinutes ||
    overlapsBooked(value.from, step, busy);

  function changeFrom(from) {
    // Keep the same length if it still fits, otherwise one hour, otherwise 30 minutes.
    const length = Math.max(30, toMinutes(value.to) - toMinutes(value.from));
    const candidates = [length, 60, 30].map((minutes) => steps.find((step) => toMinutes(step) === toMinutes(from) + minutes));
    const to = candidates.find((step) => step && !overlapsBooked(from, step, busy)) ?? candidates[2] ?? value.to;
    onChange({ from, to });
  }

  return (
    <div className="time-pick">
      <div>
        <label htmlFor={fromId}>From</label>
        <select id={fromId} className="inp" value={value.from} onChange={(event) => changeFrom(event.target.value)}>
          {steps.slice(0, -1).map((step) => (
            <option key={step} value={step} disabled={fromDisabled(step)}>
              {formatTime(step)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={toId}>To</label>
        <select id={toId} className="inp" value={value.to} onChange={(event) => onChange({ ...value, to: event.target.value })}>
          {steps.slice(1).map((step) => (
            <option key={step} value={step} disabled={toDisabled(step)}>
              {formatTime(step)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
