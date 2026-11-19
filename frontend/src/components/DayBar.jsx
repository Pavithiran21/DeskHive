import { IconArrowsHorizontal } from '@tabler/icons-react';
import { Link } from 'react-router';
import { formatRange, hourLabel, toMinutes } from '../lib/time';

/**
 * A room's day from opening to closing time: booked blocks (never who booked), my own booking as an
 * ink block that opens it, and the pick in rose. On a phone it scrolls sideways inside its box.
 *
 * Props: opensAt, closesAt ("HH:mm:ss"), blocks [{ from, to, mine, bookingId }], pick { from, to } or
 * null, currentId (the booking being changed: drawn as "Now" instead of "You"), label.
 */
export function DayBar({ opensAt, closesAt, blocks, pick, currentId, label }) {
  const open = toMinutes(opensAt);
  const close = toMinutes(closesAt);
  const span = close - open;
  const firstHour = Math.floor(open / 60);
  const hours = Array.from({ length: Math.ceil(span / 60) }, (_, index) => firstHour + index);
  const halfHours = span / 30;
  const position = (from, to) => ({
    left: `${((toMinutes(from) - open) / span) * 100}%`,
    width: `${((toMinutes(to) - toMinutes(from)) / span) * 100}%`,
  });

  const others = blocks.filter((block) => !block.mine);
  const mine = blocks.filter((block) => block.mine);
  const summary = [
    others.length ? `Booked ${others.map((block) => formatRange(block.from, block.to)).join(' and ')}.` : 'No other bookings.',
    ...mine.map((block) => `${block.bookingId === currentId ? 'Your booking now' : 'Your booking'}: ${formatRange(block.from, block.to)}.`),
    pick ? `${currentId ? 'New pick' : 'Your pick'}: ${formatRange(pick.from, pick.to)}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className="tl-scroll" tabIndex={0} role="region" aria-label={`${label}, scroll sideways`}>
        <div className="tl">
          <div className="tl-hours" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}>
            {hours.map((hour, index) => (
              <span key={hour}>{hourLabel(hour, index === 0)}</span>
            ))}
          </div>
          <div
            className="tl-bar"
            style={{
              background: `repeating-linear-gradient(90deg, var(--seat-s) 0 calc(100% / ${halfHours} - 1px), #fff calc(100% / ${halfHours} - 1px) calc(100% / ${halfHours}))`,
            }}
          >
            <span className="sr-only">{summary}</span>
            {others.map((block) => (
              <span key={`${block.from}-${block.to}`} className="blk busy" style={position(block.from, block.to)} aria-hidden="true">
                Booked
              </span>
            ))}
            {mine.map((block) =>
              block.bookingId === currentId ? (
                <span key={block.bookingId} className="blk mine" style={position(block.from, block.to)} aria-hidden="true">
                  Now
                </span>
              ) : (
                <Link
                  key={block.bookingId}
                  to={`/bookings/${block.bookingId}`}
                  className="blk mine"
                  style={position(block.from, block.to)}
                  aria-label={`You, ${formatRange(block.from, block.to)}: open your booking`}
                >
                  You
                </Link>
              ),
            )}
            {pick && (
              <span className="blk pick" style={position(pick.from, pick.to)} aria-hidden="true">
                {currentId ? 'New' : 'Your pick'}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="legend" style={{ borderTop: 0, padding: '0 0 8px' }}>
        <span className="swipe">
          <IconArrowsHorizontal aria-hidden="true" width={16} height={16} /> Swipe for later times
        </span>
        {currentId ? (
          <span>
            <i className="k" style={{ background: 'var(--ink)' }} />
            Your time now
          </span>
        ) : (
          <span>
            <i className="k" style={{ background: 'var(--ink)' }} />
            Your booking
          </span>
        )}
        <span>
          <i className="k" style={{ background: 'var(--rose)' }} />
          {currentId ? 'New pick' : 'Your pick'}
        </span>
        <span>
          <i className="k" style={{ background: 'var(--sold)' }} />
          Booked
        </span>
      </div>
    </>
  );
}
