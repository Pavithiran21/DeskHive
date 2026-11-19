import { Link } from 'react-router';
import { Alert } from '../../components/StatePanels';
import { formatDay, formatRange } from '../../lib/time';

/** The office's rules as the reserve card lists them. */
export function RulesList({ office }) {
  if (!office) {
    return null;
  }
  const { rules } = office;
  return (
    <ul className="rules muted xs">
      <li>
        Open {formatRange(rules.opensAt, rules.closesAt)} ({office.timeZoneName})
      </li>
      <li>Book up to {rules.bookAheadDays} days ahead</li>
      <li>Up to {rules.maxBookingHours} hours · one desk a day</li>
    </ul>
  );
}

/**
 * The sticky reserve card (desk page): the chosen seat, date / time / where, Reserve, the check-in
 * note and the rules. On a phone the Reserve button moves to a sticky bar at the bottom of the page.
 */
export function ReserveCard({
  office,
  timeZoneName,
  floor,
  date,
  timeText,
  seat,
  lostMessage,
  refusal,
  disabled,
  busy,
  onReserve,
  note,
  mine,
}) {
  const label = seat ? `Reserve seat ${seat.label}` : 'Pick a free seat';
  return (
    <>
      <aside className="reserve" aria-label="Your booking">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 24 }}>{seat ? `Seat ${seat.label}` : 'Pick a seat'}</b>
          {seat && (
            <span className="muted sm">
              · {seat.area}, row {seat.row}
            </span>
          )}
        </div>
        {lostMessage && <Alert className="mt-3" message={lostMessage} />}
        {refusal && <Alert className="mt-3" message={refusal.message} />}
        {mine && !refusal && (
          <Alert tone="info" className="mt-3" live={false}>
            You already hold <b>seat {mine.label}</b> at this time. One desk a day:{' '}
            <Link to={`/bookings/${mine.myBookingId}`}>open that booking</Link> to change it.
          </Alert>
        )}
        <div className="rbox">
          <div className="two">
            <div className="c">
              <small>Date</small>
              {formatDay(date)}
            </div>
            <div className="c">
              <small>Time</small>
              {timeText}
            </div>
          </div>
          <div className="c full">
            <small>Where</small>
            {[floor, office?.name, timeZoneName].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button type="button" className="btn btn-cta btn-block btn-lg reserve-btn" disabled={disabled || busy} onClick={onReserve}>
          {busy ? 'Reserving…' : label}
        </button>
        <p className="muted xs" style={{ textAlign: 'center', marginTop: 8 }}>
          {note}
        </p>
        <hr className="divider" />
        <RulesList office={office} />
      </aside>
      <div className="mbar">
        <div className="fill">
          <b className="sm">{seat ? `Seat ${seat.label}` : 'Pick a seat'}</b>
          <div className="muted xs">
            {formatDay(date)} · {timeText}
          </div>
        </div>
        <button type="button" className="btn btn-cta btn-sm" style={{ padding: '10px 16px' }} disabled={disabled || busy} onClick={onReserve}>
          {busy ? 'Reserving…' : 'Reserve'}
        </button>
      </div>
    </>
  );
}
