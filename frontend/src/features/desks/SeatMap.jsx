import { IconArrowsHorizontal, IconWheelchair } from '@tabler/icons-react';
import { useRef, useState } from 'react';

/** Seats grouped by row letter, each row as numbers 1..max so the columns line up (a missing number is a gap). */
function buildRows(seats) {
  const maxNumber = Math.max(...seats.map((seat) => seat.number));
  const byRow = new Map();
  seats.forEach((seat) => {
    if (!byRow.has(seat.row)) {
      byRow.set(seat.row, new Map());
    }
    byRow.get(seat.row).set(seat.number, seat);
  });
  return [...byRow.keys()].sort().map((row) => ({
    row,
    cells: Array.from({ length: maxNumber }, (_, index) => byRow.get(row).get(index + 1) ?? null),
  }));
}

/** An aisle after every 4th seat, like the design's theatre layout. */
const aisleAfter = (index, length) => (index + 1) % 4 === 0 && index + 1 < length;

// In Change booking the seat held now is ink ("current") until another seat is picked; picking it
// again keeps the seat and changes only the date or time.
function seatState(seat, { selectedId, lostId, currentId }) {
  if (seat.id === lostId) return 'lost';
  if (seat.id === selectedId) return 'selected';
  if (seat.id === currentId) return 'current';
  if (seat.state === 'MINE') return 'mine';
  if (seat.state === 'BOOKED') return 'booked';
  return 'free';
}

const CLASS = { current: 's mine', mine: 's mine', lost: 's just', selected: 's sel', booked: 's x', free: 's' };

function seatLabel(seat, state) {
  const accessible = seat.features.includes('ACCESSIBLE') ? ', accessible' : '';
  const words = {
    current: 'your seat now',
    mine: 'your seat, open booking',
    lost: 'just booked by someone else',
    selected: 'selected',
    booked: 'booked',
    free: 'free',
  }[state];
  // A seat shows its number (or a wheelchair icon), so the name starts with the row and that number.
  const name = seat.features.includes('ACCESSIBLE') ? seat.label : `Row ${seat.row}, seat ${seat.number}`;
  return `${name}, ${words}${accessible}`;
}

/**
 * The theatre-style seat map: row letters on both sides, aisles, wheelchair seats, "Windows this way".
 * It is one Tab stop (roving tabindex): the arrow keys move between seats and Enter or Space picks one.
 * Booked seats stay focusable but are aria-disabled; the lost seat after a 409 is dashed red.
 *
 * Props: seats, selectedId, lostId (dashed red), currentId (the booking being changed, in ink),
 * onPick(seat), onOpenMine(seat), label (for the group), legend: 'book' | 'change'.
 */
export function SeatMap({ seats, selectedId, lostId, currentId, onPick, onOpenMine, label, legend = 'book' }) {
  const rows = buildRows(seats);
  const order = rows.flatMap((row) => row.cells.filter(Boolean));
  const [focusId, setFocusId] = useState(null);
  const buttons = useRef(new Map());
  const startId = order.find((seat) => seat.id === focusId)?.id ?? selectedId ?? order.find((seat) => seat.state === 'FREE')?.id ?? order[0]?.id;
  const hasWindow = seats.some((seat) => seat.features.includes('WINDOW'));
  const areas = [...new Set(seats.map((seat) => seat.area))];
  const rowLetters = rows.map((row) => row.row);

  function moveFocus(seat, key) {
    const rowIndex = rows.findIndex((row) => row.row === seat.row);
    let target = null;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const step = key === 'ArrowLeft' ? -1 : 1;
      const index = order.indexOf(seat);
      target = order[index + step];
    } else {
      const step = key === 'ArrowUp' ? -1 : 1;
      for (let next = rowIndex + step; next >= 0 && next < rows.length && !target; next += step) {
        // The seat with the same number, or the nearest one in that row.
        const candidates = rows[next].cells.filter(Boolean);
        target = candidates.reduce(
          (best, candidate) =>
            !best || Math.abs(candidate.number - seat.number) < Math.abs(best.number - seat.number) ? candidate : best,
          null,
        );
      }
    }
    if (key === 'Home') target = order[0];
    if (key === 'End') target = order[order.length - 1];
    if (target) {
      setFocusId(target.id);
      buttons.current.get(target.id)?.focus();
    }
  }

  function handleKeyDown(event, seat) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      moveFocus(seat, event.key);
    }
  }

  function handleClick(seat, state) {
    setFocusId(seat.id);
    if (state === 'mine') {
      onOpenMine?.(seat);
    } else if (state === 'free' || state === 'selected' || state === 'current') {
      onPick(seat);
    }
  }

  return (
    <div className="layout">
      <div className="scroll" tabIndex={-1} role="region" aria-label={`${label}, scroll sideways on a small screen`}>
        <div className="map" role="group" aria-label={`Seat layout, ${label}`}>
          <div className="sect">
            {areas.join(', ')} ·{' '}
            {rowLetters.length > 1 ? `rows ${rowLetters[0]}–${rowLetters[rowLetters.length - 1]}` : `row ${rowLetters[0]}`}
          </div>
          {rows.map(({ row, cells }) => (
            <div key={row} className="srow">
              <span className="rl" aria-hidden="true">
                {row}
              </span>
              {cells.map((seat, index) => {
                const aisle = aisleAfter(index, cells.length) ? <span className="aisle" /> : null;
                if (!seat) {
                  return (
                    <span key={`e${index}`} style={{ display: 'contents' }}>
                      <span className="empty" aria-hidden="true" />
                      {aisle}
                    </span>
                  );
                }
                const state = seatState(seat, { selectedId, lostId, currentId });
                const unavailable = state === 'booked' || state === 'lost';
                return (
                  <span key={seat.id} style={{ display: 'contents' }}>
                    <button
                      ref={(element) => {
                        if (element) buttons.current.set(seat.id, element);
                        else buttons.current.delete(seat.id);
                      }}
                      type="button"
                      className={CLASS[state]}
                      tabIndex={seat.id === startId ? 0 : -1}
                      aria-label={seatLabel(seat, state)}
                      aria-pressed={state === 'selected'}
                      aria-disabled={unavailable || undefined}
                      onKeyDown={(event) => handleKeyDown(event, seat)}
                      onClick={() => handleClick(seat, state)}
                    >
                      {seat.features.includes('ACCESSIBLE') ? <IconWheelchair aria-hidden="true" /> : seat.number}
                    </button>
                    {aisle}
                  </span>
                );
              })}
              <span className="rl" aria-hidden="true">
                {row}
              </span>
            </div>
          ))}
          {hasWindow && (
            <div className="screen" aria-hidden="true">
              <div />
              <small>Windows this way</small>
            </div>
          )}
        </div>
      </div>
      <div className="legend">
        <span className="swipe">
          <IconArrowsHorizontal aria-hidden="true" width={16} height={16} /> Swipe for more seats
        </span>
        {legend === 'change' ? (
          <>
            <span>
              <i className="k" style={{ background: 'var(--ink)' }} />
              Your seat now
            </span>
            <span>
              <i className="k" style={{ background: 'var(--rose)' }} />
              New pick
            </span>
          </>
        ) : (
          <span>
            <i className="k" style={{ background: 'var(--rose)' }} />
            Your pick
          </span>
        )}
        <span>
          <i className="k" style={{ border: '1.5px solid var(--seat)' }} />
          Free
        </span>
        <span>
          <i className="k" style={{ background: 'var(--sold)' }} />
          Booked
        </span>
        {legend === 'book' && (
          <span>
            <i className="k" style={{ background: 'var(--ink)' }} />
            Your seat
          </span>
        )}
        <span>
          <i className="k" style={{ border: '1.5px solid var(--seat)', color: 'var(--seat-t)' }}>
            <IconWheelchair aria-hidden="true" />
          </i>
          Accessible
        </span>
      </div>
    </div>
  );
}
