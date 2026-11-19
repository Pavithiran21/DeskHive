import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useState } from 'react';
import { addDays, formatDay, monthGrid, monthTitle, todayIn } from '../lib/time';

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/**
 * A month calendar in the office's zone. Past days and days beyond the book-ahead limit are disabled
 * (the server refuses them with 422 anyway). The picked day is aria-pressed.
 */
export function DateCalendar({ office, value, onChange }) {
  const today = todayIn(office.timeZone);
  const lastDay = addDays(today, office.rules.bookAheadDays);
  const [view, setView] = useState(() => {
    const [year, month] = (value ?? today).split('-').map(Number);
    return { year, month: month - 1 };
  });

  const cells = monthGrid(view.year, view.month);
  const firstOfView = `${view.year}-${String(view.month + 1).padStart(2, '0')}-01`;
  const canGoBack = firstOfView > today;
  const canGoForward = cells[cells.length - 1] < lastDay;

  function move(step) {
    setView(({ year, month }) => {
      const next = month + step;
      return { year: year + Math.floor(next / 12), month: ((next % 12) + 12) % 12 };
    });
  }

  return (
    <div>
      <div className="row-flex" style={{ marginBottom: 10 }}>
        <button type="button" className="icon-btn" aria-label="Previous month" disabled={!canGoBack} onClick={() => move(-1)}>
          <IconChevronLeft />
        </button>
        <b className="fill" style={{ textAlign: 'center' }} aria-live="polite">
          {monthTitle(view.year, view.month)}
        </b>
        <button type="button" className="icon-btn" aria-label="Next month" disabled={!canGoForward} onClick={() => move(1)}>
          <IconChevronRight />
        </button>
      </div>
      <div className="cal">
        {DOW.map((day) => (
          <span key={day} className="dow" aria-hidden="true">
            {day}
          </span>
        ))}
        {cells.map((day, index) => {
          if (!day) {
            return <span key={`e${index}`} />;
          }
          const disabled = day < today || day > lastDay;
          const label = `${day === today ? 'Today, ' : ''}${formatDay(day)}${day === value ? ', selected' : ''}`;
          return (
            <button
              key={day}
              type="button"
              className={day === today ? 'today' : undefined}
              disabled={disabled}
              aria-pressed={day === value}
              aria-label={label}
              onClick={() => onChange(day)}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
      <p className="muted xs" style={{ marginTop: 10 }}>
        You can book up to {office.rules.bookAheadDays} days ahead, to {formatDay(lastDay)}. Past days can't be picked.
      </p>
    </div>
  );
}
