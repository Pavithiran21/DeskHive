import { IconChevronRight, IconMapPinCheck } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { listMyBookings } from '../../api/bookings';
import { keys } from '../../api/queryClient';
import { Pager } from '../../components/Pager';
import { SpacePicture } from '../../components/SpacePicture';
import { EmptyState, ErrorPanel, Skeleton } from '../../components/StatePanels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppHeader } from '../../layout/AppHeader';
import { bookingTag, spaceShort, spaceTitle, whenText } from '../../lib/bookingText';
import { pictureForSpace } from '../../lib/pictures';
import { formatDay, formatInstantTime, todayIn } from '../../lib/time';
import { useBookingActions } from './useBookingActions';

/** The second line of a past booking: what happened to it. */
function pastLine(booking) {
  const day = formatDay(booking.date);
  if (booking.status === 'AUTO_RELEASED') {
    return `${day} · not checked in by ${booking.checkIn.closesAtLocal}`;
  }
  if (booking.status === 'CHECKED_IN' && booking.checkedInAt) {
    return `${day} · checked in ${formatInstantTime(booking.checkedInAt, booking.timeZone)}`;
  }
  if (booking.status === 'CANCELLED' && booking.cancellation?.byAdmin) {
    return `${day} · cancelled by ${booking.cancellation.byName}: ${booking.cancellation.reason}`;
  }
  return `${whenText(booking)} · ${booking.space.floor}`;
}

/** Minutes from now until an instant, never below 0; refreshed every 30 seconds by the caller. */
function minutesUntil(instant, now) {
  return Math.max(0, Math.ceil((new Date(instant).getTime() - now) / 60000));
}

function TodayCard({ booking, onCheckIn, busy }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const open = booking.actions.canCheckIn;
  return (
    <div className="today">
      <div className="top">
        <div className="kicker">Today · {spaceShort(booking.space)}</div>
        {open ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, margin: '10px 0', flexWrap: 'wrap' }}>
            <div className="count">{minutesUntil(booking.checkIn.closesAt, now)} min</div>
            <div className="xs">
              left to check in
              <br />
              (by {booking.checkIn.closesAtLocal} {booking.timeZoneName})
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, margin: '10px 0', flexWrap: 'wrap' }}>
            <div className="count">{booking.checkIn.opensAtLocal}</div>
            <div className="xs">
              check-in opens
              <br />({booking.timeZoneName})
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '16px 20px' }}>
        {open ? (
          <button type="button" className="btn btn-cta btn-block" disabled={busy} onClick={() => onCheckIn(booking)}>
            <IconMapPinCheck aria-hidden="true" /> I'm here, check in
          </button>
        ) : (
          <Link to={`/bookings/${booking.id}`} className="btn btn-line btn-block">
            View booking
          </Link>
        )}
        <p className="muted xs" style={{ marginTop: 8 }}>
          Check-in opens 15 minutes before the start. If you don't check in, the seat goes back to your team and we email you.
          Rooms work the same way.
        </p>
      </div>
    </div>
  );
}

function BookingRow({ booking, tab, onCheckIn, busy }) {
  const navigate = useNavigate();
  const tag = bookingTag(booking);
  return (
    // The title is the link (keyboard and screen readers); a click anywhere else on the row opens it too.
    <div
      className="trip"
      onClick={(event) => {
        if (!event.target.closest('a, button')) navigate(`/bookings/${booking.id}`);
      }}
      style={{ cursor: 'pointer' }}
    >
      <div className="ph">
        <SpacePicture kind={pictureForSpace(booking.space)} />
      </div>
      <div style={{ minWidth: 0 }}>
        <Link to={`/bookings/${booking.id}`} className="ttl">
          {spaceTitle(booking.space)}
        </Link>
        <div className="muted sm">{tab === 'past' ? pastLine(booking) : `${whenText(booking)} · ${booking.space.floor}`}</div>
        <span className={`tag ${tag.tone}`} style={{ marginTop: 6 }}>
          {tag.text}
        </span>
      </div>
      {booking.actions.canCheckIn ? (
        <button type="button" className="btn btn-dark btn-sm" disabled={busy} onClick={() => onCheckIn(booking)}>
          Check in
        </button>
      ) : (
        <IconChevronRight className="go-i" aria-hidden="true" />
      )}
    </div>
  );
}

/** /bookings: Upcoming and Past tabs, Check in on today's bookings, and a "Today" card. */
export function MyBookingsPage() {
  usePageTitle('My bookings');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'past' ? 'past' : 'upcoming';
  const page = Number(params.get('page') ?? 1);
  const { checkInMutation } = useBookingActions();

  const list = useQuery({
    queryKey: keys.myBookings(tab, page),
    queryFn: () => listMyBookings({ tab, page }),
    placeholderData: (previous) => previous,
  });
  // The count on the Upcoming tab and the Today card always come from the first upcoming page.
  const upcoming = useQuery({ queryKey: keys.myBookings('upcoming', 1), queryFn: () => listMyBookings({ tab: 'upcoming', page: 1 }) });

  const todayBooking = upcoming.data?.items.find(
    (booking) => booking.date === todayIn(booking.timeZone) && booking.status === 'CONFIRMED' && !booking.ended,
  );

  function selectTab(next) {
    setParams(next === 'past' ? { tab: 'past' } : {}, { replace: true });
  }

  function onTabKey(event) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = tab === 'past' ? 'upcoming' : 'past';
      selectTab(next);
      document.getElementById(`tab-${next}`)?.focus();
    }
  }

  let content;
  if (list.isPending) {
    content = <Skeleton className="" label="Loading your bookings…" blocks={2} lines={2} />;
  } else if (list.isError) {
    content = <ErrorPanel error={list.error} onRetry={() => list.refetch()} />;
  } else if (list.data.items.length === 0) {
    content =
      tab === 'past' ? (
        <EmptyState logo title="No past bookings yet" text="Bookings you've had show here once they're over." />
      ) : (
        <EmptyState logo title="No bookings yet" text="Find a seat for the next day you're in.">
          <Link to="/home" className="btn btn-cta">
            Find a space
          </Link>
        </EmptyState>
      );
  } else {
    content = list.data.items.map((booking) => (
      <BookingRow key={booking.id} booking={booking} tab={tab} onCheckIn={(b) => checkInMutation.mutate(b)} busy={checkInMutation.isPending} />
    ));
  }

  return (
    <>
      <AppHeader />
      <main className="page">
        <div className="trips">
          <div className="card pad" style={{ paddingBottom: 0 }}>
            <h1 style={{ fontSize: 26, marginBottom: 14 }}>My bookings</h1>
            <div className="tabs" role="tablist" aria-label="Bookings">
              <button
                id="tab-upcoming"
                type="button"
                role="tab"
                aria-selected={tab === 'upcoming'}
                aria-controls="bookings-panel"
                tabIndex={tab === 'upcoming' ? 0 : -1}
                onClick={() => selectTab('upcoming')}
                onKeyDown={onTabKey}
              >
                Upcoming{upcoming.data ? ` · ${upcoming.data.totalItems}` : ''}
              </button>
              <button
                id="tab-past"
                type="button"
                role="tab"
                aria-selected={tab === 'past'}
                aria-controls="bookings-panel"
                tabIndex={tab === 'past' ? 0 : -1}
                onClick={() => selectTab('past')}
                onKeyDown={onTabKey}
              >
                Past
              </button>
            </div>
            <div id="bookings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} style={{ paddingBottom: list.data?.items.length ? 0 : 20 }}>
              {content}
            </div>
            <div style={{ margin: '0 -20px' }}>
              <Pager data={list.data} onPage={(next) => setParams(tab === 'past' ? { tab, page: next } : { page: next }, { replace: true })} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            {todayBooking && (
              <TodayCard booking={todayBooking} onCheckIn={(b) => checkInMutation.mutate(b)} busy={checkInMutation.isPending} />
            )}
            <div className="card pad">
              <b>What each status allows</b>
              <p className="muted sm" style={{ marginTop: 6 }}>
                Change a booking until it starts. Cancel it until you check in. Check in from 15 minutes before the start
                until 15 minutes after; a booking not checked in by then is released and you get an email.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
