import { useId } from 'react';
import { SLOTS, timeProblem } from '../lib/slots';
import { formatRange, formatTime, halfHourSteps, nowMinutesIn, todayIn, toMinutes } from '../lib/time';

/**
 * The time choice: Morning, Afternoon, Full day and Custom, as native radio buttons in a fieldset
 * (showtime-style chips). A chip whose time has started today, or that breaks the office's opening
 * hours or longest booking, is disabled. Custom shows From / To in 30-minute steps.
 * value: { slot, from, to } with from/to as "HH:mm"; onChange gets the same shape.
 */
export function TimeChips({ office, date, value, onChange, legend = 'Time', className = 'slots' }) {
  const name = useId();
  const fromId = useId();
  const toId = useId();
  const rules = office?.rules;

  function pickPreset(slot) {
    onChange({ slot: slot.id, from: slot.from, to: slot.to });
  }

  function pickCustom() {
    onChange({ slot: 'custom', from: value.from, to: value.to });
  }

  const steps = rules ? halfHourSteps(rules.opensAt, rules.closesAt) : [];
  const isToday = office && date === todayIn(office.timeZone);
  const now = isToday ? nowMinutesIn(office.timeZone) : -1;

  return (
    <>
      <fieldset className={className}>
        <legend>{legend}</legend>
        {SLOTS.map((slot) => {
          const problem = timeProblem({ date, from: slot.from, to: slot.to, office });
          return (
            <label key={slot.id} className="slot">
              <input
                type="radio"
                name={name}
                checked={value.slot === slot.id}
                disabled={Boolean(problem)}
                onChange={() => pickPreset(slot)}
              />
              <span>
                {slot.label}
                <small>{formatRange(slot.from, slot.to)}</small>
              </span>
            </label>
          );
        })}
        <label className="slot">
          <input type="radio" name={name} checked={value.slot === 'custom'} onChange={pickCustom} />
          <span>
            Custom
            <small>{value.slot === 'custom' ? formatRange(value.from, value.to) : 'pick times'}</small>
          </span>
        </label>
      </fieldset>
      {value.slot === 'custom' && rules && (
        <>
          <div className="time-pick" style={{ marginTop: 12 }}>
            <div>
              <label htmlFor={fromId}>From</label>
              <select
                id={fromId}
                className="inp"
                value={value.from}
                onChange={(event) => onChange({ ...value, from: event.target.value })}
              >
                {steps.slice(0, -1).map((step) => (
                  <option key={step} value={step} disabled={toMinutes(step) <= now}>
                    {formatTime(step)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={toId}>To</label>
              <select
                id={toId}
                className="inp"
                value={value.to}
                onChange={(event) => onChange({ ...value, to: event.target.value })}
              >
                {steps.slice(1).map((step) => (
                  <option key={step} value={step} disabled={toMinutes(step) <= toMinutes(value.from)}>
                    {formatTime(step)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="muted xs" style={{ marginTop: -6 }}>
            Custom times move in 30-minute steps, inside opening hours ({formatRange(rules.opensAt, rules.closesAt)}{' '}
            {office.timeZoneName}), up to {rules.maxBookingHours} hours.
          </p>
        </>
      )}
    </>
  );
}
