import { IconArrowLeft } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { createBooking } from '../../api/bookings';
import { invalidateBookingViews, keys } from '../../api/queryClient';
import { getSeatMap } from '../../api/spaces';
import { Alert, ErrorPanel, Skeleton } from '../../components/StatePanels';
import { TimeChips } from '../../components/TimeChips';
import { useOffices } from '../../hooks/useOffices';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppHeader } from '../../layout/AppHeader';
import { isPageError } from '../../lib/apiErrors';
import { DEFAULT_SLOT, slotLabel, slotTimes, timeProblem } from '../../lib/slots';
import { formatDay, formatRange } from '../../lib/time';
import { NotFoundPage } from '../../pages/ErrorPages';
import { useToast } from '../../toast/ToastContext';
import { checkInNote, officeOfFloor, seatFacts } from './deskHelpers';
import { ReserveCard } from './ReserveCard';
import { SeatMap } from './SeatMap';

/**
 * /spaces/desks/:floorId?area=…&date=…&slot=…: pick a time chip and a free seat, then reserve.
 * If someone else wins the seat first (409 SPACE_TAKEN), the seat turns dashed red, the time is kept
 * and the nearest free seat from the error's details is picked.
 */
export function DeskAreaPage() {
  const { floorId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const offices = useOffices();
  const office = officeOfFloor(offices.data, floorId);

  const area = params.get('area');
  const date = params.get('date');
  const slot = params.get('slot') ?? DEFAULT_SLOT;
  const { from, to } = slotTimes(slot, params.get('from'), params.get('to'));
  usePageTitle(area ?? 'Desks');

  const [selectedId, setSelectedId] = useState(null);
  const [lost, setLost] = useState(null); // { id, message }
  const [refusal, setRefusal] = useState(null);

  const seatMap = useQuery({
    queryKey: keys.seatMap(floorId, { area, date, from, to }),
    queryFn: () => getSeatMap(floorId, { area, date, from, to }),
    enabled: Boolean(date),
    placeholderData: (previous) => previous,
  });

  const reserve = useMutation({
    mutationFn: (seat) => createBooking({ spaceId: seat.id, date, startTime: from, endTime: to }),
    onSuccess: (booking) => {
      setSelectedId(null);
      setLost(null);
      invalidateBookingViews();
      showToast({
        message: `Seat ${booking.space.label} reserved for ${formatDay(booking.date)}`,
        action: { label: 'View', to: `/bookings/${booking.id}` },
      });
    },
    onError: (error, seat) => {
      if (error.code === 'SPACE_TAKEN') {
        const suggestedId = error.detail('suggestedSpaceId');
        const suggestedLabel = error.detail('suggestedLabel');
        const extra = suggestedId
          ? `We kept your time and picked ${suggestedLabel} next to it. Check it and reserve, or pick another seat.`
          : 'Every desk in this area is taken at that time. Try another time or a meeting room.';
        setLost({ id: seat.id, message: `${error.message} ${extra}` });
        setSelectedId(suggestedId ? Number(suggestedId) : null);
        seatMap.refetch();
        return;
      }
      setRefusal(error);
    },
  });

  function changeTime(value) {
    setLost(null);
    setRefusal(null);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('slot', value.slot);
        if (value.slot === 'custom') {
          next.set('from', value.from);
          next.set('to', value.to);
        } else {
          next.delete('from');
          next.delete('to');
        }
        return next;
      },
      { replace: true },
    );
  }

  if (!date) {
    return <NotFoundPage />;
  }
  if (seatMap.isError && isPageError(seatMap.error)) {
    return <NotFoundPage />;
  }

  const data = seatMap.data;
  const seats = data?.seats ?? [];
  const selected = seats.find((seat) => seat.id === selectedId) ?? null;
  const problem = office ? timeProblem({ date, from, to, office }) : null;
  const homeQuery = new URLSearchParams({ office: String(office?.id ?? ''), date, slot });
  if (slot === 'custom') {
    homeQuery.set('from', from);
    homeQuery.set('to', to);
  }
  const title = `${area ?? 'Desks'} · ${data?.floor ?? ''}`;

  // The lost seat stays dashed red (and its message stays) until the next reservation is tried.
  function pick(seat) {
    setRefusal(null);
    setSelectedId(seat.id);
  }

  return (
    <>
      <AppHeader />
      <main className="detail">
        <div style={{ minWidth: 0 }}>
          <Link className="back" to={`/home?${homeQuery}`}>
            <IconArrowLeft aria-hidden="true" /> All spaces
          </Link>
          <h1 style={{ marginTop: 6 }}>{title}</h1>
          <div className="muted" style={{ marginTop: 2 }}>
            {data?.office.name ?? office?.name} · {formatDay(date, { year: true })}
          </div>
          {seats.length > 0 && (
            <div className="facts">
              {seatFacts(seats).map(({ Icon, text }) => (
                <span key={text}>
                  <Icon aria-hidden="true" /> {text}
                </span>
              ))}
            </div>
          )}
          {office && <TimeChips office={office} date={date} value={{ slot, from, to }} onChange={changeTime} />}
          {problem === 'started' && (
            <Alert
              className="mt-3"
              message={`That time has already started. Pick a later time, or another day on Home.`}
            />
          )}
          {seatMap.isPending ? (
            <Skeleton label="Loading spaces…" lines={4} className="layout pad" />
          ) : seatMap.isError ? (
            <ErrorPanel error={seatMap.error} onRetry={() => seatMap.refetch()} />
          ) : seats.length === 0 ? (
            <div className="layout pad muted">This area has no desks.</div>
          ) : (
            <>
              {seats.every((seat) => seat.state !== 'FREE') && (
                <Alert tone="warn" className="mt-4" message={`Every desk here is taken at that time. Try another time, another day or a meeting room.`} />
              )}
              <SeatMap
                seats={seats}
                selectedId={selectedId}
                lostId={lost?.id}
                label={title}
                onPick={pick}
                onOpenMine={(seat) => navigate(`/bookings/${seat.myBookingId}`)}
              />
            </>
          )}
        </div>
        <ReserveCard
          office={office}
          timeZoneName={data?.timeZoneName}
          floor={data?.floor}
          date={date}
          from={from}
          to={to}
          timeText={slot === 'custom' ? formatRange(from, to) : `${slotLabel(slot, from, to)} · ${formatRange(from, to)}`}
          seat={selected}
          lostMessage={lost?.message}
          refusal={refusal}
          disabled={!selected || Boolean(problem)}
          busy={reserve.isPending}
          onReserve={() => {
            setRefusal(null);
            reserve.mutate(selected);
          }}
          note={checkInNote(from)}
          mine={seats.find((seat) => seat.state === 'MINE')}
        />
      </main>
    </>
  );
}
