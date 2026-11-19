import { IconArrowLeft, IconUsers } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { createBooking } from '../../api/bookings';
import { invalidateBookingViews, keys } from '../../api/queryClient';
import { getRoomDay } from '../../api/spaces';
import { DayBar } from '../../components/DayBar';
import { RoomTimePick } from '../../components/RoomTimePick';
import { Alert, ErrorPanel, Skeleton } from '../../components/StatePanels';
import { useOffice } from '../../hooks/useOffices';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppHeader } from '../../layout/AppHeader';
import { isPageError } from '../../lib/apiErrors';
import { featureInfo } from '../../lib/features';
import { firstFreePick } from '../../lib/roomTimes';
import { formatDay, formatRange, formatTime, fromMinutes, toMinutes } from '../../lib/time';
import { NotFoundPage } from '../../pages/ErrorPages';
import { useToast } from '../../toast/ToastContext';
import { RulesList } from '../desks/ReserveCard';

/** /spaces/rooms/:roomId?date=…: the day bar, From / To, and Reserve. Overlaps are refused in the card (409 ROOM_OVERLAP). */
export function RoomPage() {
  const { roomId } = useParams();
  const [params] = useSearchParams();
  const date = params.get('date');
  const { showToast } = useToast();

  const day = useQuery({
    queryKey: keys.roomDay(roomId, date),
    queryFn: () => getRoomDay(roomId, date),
    enabled: Boolean(date),
  });
  const { office } = useOffice(day.data?.office.id);
  usePageTitle(day.data?.name ?? 'Meeting room');

  // The pick the person made; until then the first free hour is shown.
  const [chosen, setChosen] = useState(null);
  const [refusal, setRefusal] = useState(null);

  const reserve = useMutation({
    mutationFn: (time) => createBooking({ spaceId: Number(roomId), date, startTime: time.from, endTime: time.to }),
    onSuccess: (booking) => {
      setChosen(null);
      setRefusal(null);
      invalidateBookingViews();
      showToast({
        message: `${booking.space.label} reserved for ${formatDay(booking.date)}, ${formatRange(booking.startTime, booking.endTime)}`,
        action: { label: 'View', to: `/bookings/${booking.id}` },
      });
    },
    onError: (error) => {
      setRefusal(error);
      if (error.code === 'ROOM_OVERLAP') {
        day.refetch();
      }
    },
  });

  if (!date || (day.isError && isPageError(day.error))) {
    return <NotFoundPage />;
  }

  const data = day.data;
  const timeZone = data?.office.timeZone;
  const pick = data ? (chosen ?? firstFreePick(data, timeZone)) : null;
  const homeQuery = new URLSearchParams({ office: String(data?.office.id ?? ''), date }).toString();

  return (
    <>
      <AppHeader />
      <main className="detail">
        <div style={{ minWidth: 0 }}>
          <Link className="back" to={`/home?${homeQuery}`}>
            <IconArrowLeft aria-hidden="true" /> All spaces
          </Link>
          {day.isPending ? (
            <Skeleton label="Loading the room…" lines={4} className="timeline" />
          ) : day.isError ? (
            <ErrorPanel error={day.error} onRetry={() => day.refetch()} />
          ) : (
            <>
              <h1 style={{ marginTop: 6 }}>
                {data.name} · {data.floor}
              </h1>
              <div className="muted" style={{ marginTop: 2 }}>
                {data.office.name} · {formatDay(date, { year: true })}
              </div>
              <div className="facts">
                <span>
                  <IconUsers aria-hidden="true" /> {data.capacity} {data.capacity === 1 ? 'seat' : 'seats'}
                </span>
                {data.features.map((code) => {
                  const { label, Icon } = featureInfo(code);
                  return (
                    <span key={code}>
                      {Icon && <Icon aria-hidden="true" />} {label}
                    </span>
                  );
                })}
              </div>
              <div className="timeline">
                <div className="row-flex" style={{ marginBottom: 6 }}>
                  <b>{formatDay(date)}</b>
                  <span className="muted sm">
                    · open {formatRange(data.opensAt, data.closesAt)} {data.timeZoneName}
                  </span>
                </div>
                <DayBar opensAt={data.opensAt} closesAt={data.closesAt} blocks={data.blocks} pick={pick} label={`${data.name} on ${formatDay(date)}`} />
                {pick ? (
                  <RoomTimePick
                    day={data}
                    timeZone={timeZone}
                    value={pick}
                    onChange={(value) => {
                      setRefusal(null);
                      setChosen(value);
                    }}
                  />
                ) : (
                  <Alert tone="warn" message="Nothing is free in this room that day. Try another day or another room." />
                )}
                <p className="muted xs" style={{ marginTop: -6 }}>
                  Booked times can't be picked. Bookings by others show only as "Booked", never who booked.
                </p>
              </div>
            </>
          )}
        </div>
        {data && (
          <>
            <aside className="reserve" aria-label="Your room booking">
              <b style={{ fontSize: 24 }}>{data.name}</b>
              <div className="rbox">
                <div className="two">
                  <div className="c">
                    <small>Date</small>
                    {formatDay(date)}
                  </div>
                  <div className="c">
                    <small>Time</small>
                    {pick ? formatRange(pick.from, pick.to) : '—'}
                  </div>
                </div>
                <div className="c full">
                  <small>Where</small>
                  {data.floor} · {data.office.name} · {data.timeZoneName}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-cta btn-block btn-lg reserve-btn"
                disabled={!pick || reserve.isPending}
                onClick={() => reserve.mutate(pick)}
              >
                {reserve.isPending ? 'Reserving…' : `Reserve ${data.name}`}
              </button>
              {pick && (
                <p className="muted xs" style={{ textAlign: 'center', marginTop: 8 }}>
                  Check in from {formatTime(fromMinutes(toMinutes(pick.from) - 15))}, by {formatTime(fromMinutes(toMinutes(pick.from) + 15))}.
                </p>
              )}
              {refusal && <Alert className="mt-3.5" message={refusal.message} />}
              <hr className="divider" />
              <RulesList office={office} />
            </aside>
            <div className="mbar">
              <div className="fill">
                <b className="sm">{pick ? formatRange(pick.from, pick.to) : data.name}</b>
                <div className="muted xs">{formatDay(date)}</div>
              </div>
              <button type="button" className="btn btn-cta btn-sm" style={{ padding: '10px 16px' }} disabled={!pick || reserve.isPending} onClick={() => reserve.mutate(pick)}>
                Reserve
              </button>
            </div>
          </>
        )}
      </main>
    </>
  );
}
