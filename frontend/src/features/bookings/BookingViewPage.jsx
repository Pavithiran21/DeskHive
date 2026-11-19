import { IconArrowLeft, IconClockX, IconMapPinCheck, IconPencil } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { getBooking } from '../../api/bookings';
import { keys } from '../../api/queryClient';
import { SpacePicture } from '../../components/SpacePicture';
import { Alert, ErrorPanel, Skeleton } from '../../components/StatePanels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppHeader } from '../../layout/AppHeader';
import { isPageError } from '../../lib/apiErrors';
import { bookingTag, spaceTitle } from '../../lib/bookingText';
import { pictureForSpace } from '../../lib/pictures';
import { formatDay, formatInstant, formatInstantTime, formatRange, todayIn } from '../../lib/time';
import { NotFoundPage } from '../../pages/ErrorPages';
import { CancelDialog } from './CancelDialog';
import { useBookingActions } from './useBookingActions';

/** "Today, Mon 19 Oct" or "Tue 20 Oct 2026" */
function dayText(booking) {
  return booking.date === todayIn(booking.timeZone) ? `Today, ${formatDay(booking.date)}` : formatDay(booking.date, { year: true });
}

/**
 * /bookings/:id: read-only details. The buttons come from booking.actions (canChange, canCancel,
 * canCheckIn); this page never works the status rules out itself. The reminder email links here.
 */
export function BookingViewPage() {
  const { id } = useParams();
  const booking = useQuery({ queryKey: keys.booking(id), queryFn: () => getBooking(id) });
  usePageTitle(booking.data ? spaceTitle(booking.data.space) : 'Booking');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [checkInError, setCheckInError] = useState(null);
  const [cancelError, setCancelError] = useState(null);
  const { checkInMutation, cancelMutation } = useBookingActions({
    onCheckInError: setCheckInError,
    onCancelled: () => setCancelOpen(false),
    onCancelError: setCancelError,
  });

  if (booking.isError && isPageError(booking.error)) {
    return <NotFoundPage />;
  }

  let body;
  if (booking.isPending) {
    body = <Skeleton label="Loading the booking…" blocks={1} lines={4} />;
  } else if (booking.isError) {
    body = <ErrorPanel error={booking.error} onRetry={() => booking.refetch()} />;
  } else {
    const b = booking.data;
    const tag = bookingTag(b);
    const findAnother = b.space.type === 'DESK' ? 'Find another seat' : 'Find another room';
    const tooLate = b.status === 'AUTO_RELEASED' || checkInError?.code === 'CHECK_IN_CLOSED';
    const readOnly = !b.actions.canChange && !b.actions.canCancel && !b.actions.canCheckIn;
    body = (
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ height: 160 }}>
          <SpacePicture kind={pictureForSpace(b.space)} />
        </div>
        <div className="pad">
          <Link className="back" to="/bookings">
            <IconArrowLeft aria-hidden="true" /> My bookings
          </Link>
          <div className="row-flex" style={{ margin: '6px 0 14px' }}>
            <h1 className="fill" style={{ fontSize: 24 }}>
              {spaceTitle(b.space)}
            </h1>
            <span className={`tag ${tag.tone}`}>{tag.text}</span>
          </div>
          {tooLate && (
            <Alert tone="err" Icon={IconClockX} className="mb-3">
              <b>Too late to check in.</b> Check-in closed at {b.checkIn.closesAtLocal}, so the seat went back to your team.
            </Alert>
          )}
          {checkInError && !tooLate && <Alert className="mb-3" message={checkInError.message} />}
          <dl className="dl">
            <dt>Date</dt>
            <dd>{dayText(b)}</dd>
            <dt>Time</dt>
            <dd>
              {formatRange(b.startTime, b.endTime)} {b.timeZoneName}
            </dd>
            <dt>Where</dt>
            <dd>
              {b.space.floor} · {b.space.office}
            </dd>
            {b.status === 'CONFIRMED' && !b.ended && (
              <>
                <dt>Check in</dt>
                <dd>
                  {b.checkIn.opensAtLocal} – {b.checkIn.closesAtLocal}
                </dd>
              </>
            )}
            {b.status === 'CHECKED_IN' && b.checkedInAt && (
              <>
                <dt>Checked in</dt>
                <dd>{formatInstantTime(b.checkedInAt, b.timeZone)}</dd>
              </>
            )}
            {b.status === 'CANCELLED' && b.cancellation && (
              <>
                <dt>Cancelled by</dt>
                <dd>{b.cancellation.byAdmin ? b.cancellation.byName : 'You'}</dd>
                {b.cancellation.reason && (
                  <>
                    <dt>Reason</dt>
                    <dd>{b.cancellation.reason}</dd>
                  </>
                )}
              </>
            )}
            <dt>Booked</dt>
            <dd>{formatInstant(b.bookedAt, b.timeZone)}</dd>
          </dl>
          <div className="row-flex" style={{ marginTop: 18 }}>
            {b.actions.canCheckIn && (
              <button type="button" className="btn btn-cta" disabled={checkInMutation.isPending} onClick={() => checkInMutation.mutate(b)}>
                <IconMapPinCheck aria-hidden="true" /> {checkInMutation.isPending ? 'Checking in…' : 'Check in'}
              </button>
            )}
            {b.actions.canChange && (
              <Link to={`/bookings/${b.id}/change`} className="btn btn-line">
                <IconPencil aria-hidden="true" /> Change booking
              </Link>
            )}
            {b.actions.canCancel && (
              <button
                type="button"
                className="btn btn-text btn-red"
                onClick={() => {
                  setCancelError(null);
                  setCancelOpen(true);
                }}
              >
                Cancel booking
              </button>
            )}
            {(tooLate || b.status === 'CANCELLED') && (
              <Link to="/home" className="btn btn-line">
                {findAnother}
              </Link>
            )}
          </div>
          {b.actions.canChange && (
            <p className="muted xs" style={{ marginTop: 10 }}>
              Check in appears here from {b.checkIn.opensAtLocal} on the day.
            </p>
          )}
          {b.actions.canCheckIn && !b.actions.canChange && (
            <p className="muted xs" style={{ marginTop: 10 }}>
              The booking has started, so it can't be changed any more.
            </p>
          )}
          {readOnly && !tooLate && b.status !== 'CANCELLED' && (
            <p className="muted xs" style={{ marginTop: 10 }}>
              Nothing left to change or cancel.
            </p>
          )}
        </div>
        <CancelDialog
          booking={b}
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          onConfirm={() => cancelMutation.mutate(b)}
          busy={cancelMutation.isPending}
          error={cancelError}
        />
      </div>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="page" style={{ maxWidth: 760 }}>
        {body}
      </main>
    </>
  );
}
