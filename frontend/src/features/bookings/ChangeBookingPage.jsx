import { IconArrowLeft, IconCalendar } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { changeBooking, getBooking } from '../../api/bookings';
import { invalidateBookingViews, keys } from '../../api/queryClient';
import { getRoomDay, getSeatMap } from '../../api/spaces';
import { DateCalendar } from '../../components/DateCalendar';
import { DayBar } from '../../components/DayBar';
import { FieldError } from '../../components/Fields';
import { RoomTimePick } from '../../components/RoomTimePick';
import { Alert, ErrorPanel, Skeleton } from '../../components/StatePanels';
import { TimeChips } from '../../components/TimeChips';
import { useDismiss } from '../../hooks/useDismiss';
import { useOffice } from '../../hooks/useOffices';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppHeader } from '../../layout/AppHeader';
import { isPageError } from '../../lib/apiErrors';
import { spaceShort } from '../../lib/bookingText';
import { slotIdFor, slotLabel } from '../../lib/slots';
import { formatDay, formatRange, hhmm } from '../../lib/time';
import { NotFoundPage } from '../../pages/ErrorPages';
import { useToast } from '../../toast/ToastContext';
import { SeatMap } from '../desks/SeatMap';

/** The date button with its calendar popover. */
function DateButton({ office, value, onChange, errorId }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const button = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, wrap, close, button);
  return (
    <div ref={wrap} style={{ position: 'relative', marginTop: 12 }}>
      <button
        ref={button}
        type="button"
        className="btn btn-soft btn-sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={errorId}
        onClick={() => setOpen((current) => !current)}
      >
        <IconCalendar aria-hidden="true" /> Date: {formatDay(value)}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Choose a date" style={{ left: 0 }}>
          <DateCalendar
            office={office}
            value={value}
            onChange={(day) => {
              onChange(day);
              setOpen(false);
              button.current?.focus();
            }}
          />
        </div>
      )}
    </div>
  );
}

function slotWords(slot, from, to) {
  return slot === 'custom' ? formatRange(from, to) : `${slotLabel(slot, from, to).toLowerCase()} (${formatRange(from, to)})`;
}

/**
 * Desk: a date button and time chips above the seat map, the seat held now in ink and the new pick in
 * rose. The server swaps it in one transaction: if the new seat or time is taken first, nothing changes.
 */
function DeskChange({ booking, office, onSaved }) {
  const dateErrorId = useId();
  const [date, setDate] = useState(booking.date);
  const [time, setTime] = useState(() => {
    const from = hhmm(booking.startTime);
    const to = hhmm(booking.endTime);
    return { slot: slotIdFor(from, to), from, to };
  });
  const [selectedId, setSelectedId] = useState(null); // null = keep the current seat
  const [lost, setLost] = useState(null);
  const [dateError, setDateError] = useState(null);
  const [refusal, setRefusal] = useState(null);

  const seatMap = useQuery({
    queryKey: keys.seatMap(booking.space.floorId, { area: booking.space.area, date, from: time.from, to: time.to }),
    queryFn: () => getSeatMap(booking.space.floorId, { area: booking.space.area, date, from: time.from, to: time.to }),
    placeholderData: (previous) => previous,
  });

  const save = useMutation({
    mutationFn: () =>
      changeBooking(booking.id, { spaceId: selectedId ?? booking.space.id, date, startTime: time.from, endTime: time.to }),
    onSuccess: onSaved,
    onError: (error) => {
      if (error.code === 'SPACE_TAKEN') {
        setLost({ id: selectedId, message: error.message });
        setSelectedId(null);
        seatMap.refetch();
      } else if (error.code === 'ONE_DESK_PER_DAY') {
        setDateError(error.message);
      } else {
        setRefusal(error);
      }
    },
  });

  function clearMessages() {
    setDateError(null);
    setRefusal(null);
  }

  const seats = seatMap.data?.seats ?? [];
  const newSeat = seats.find((seat) => seat.id === selectedId);
  const oldFrom = hhmm(booking.startTime);
  const oldTo = hhmm(booking.endTime);
  const unchanged = !selectedId && date === booking.date && time.from === oldFrom && time.to === oldTo;
  const oldSlot = slotIdFor(oldFrom, oldTo);

  return (
    <>
      <p className="muted sm">
        Now: {spaceShort(booking.space)} · {formatDay(booking.date)} · {slotLabel(oldSlot, oldFrom, oldTo)}
      </p>
      <DateButton
        office={office}
        value={date}
        errorId={dateError ? dateErrorId : undefined}
        onChange={(day) => {
          clearMessages();
          setLost(null);
          setDate(day);
        }}
      />
      {dateError && (
        <div style={{ marginTop: 18 }}>
          <FieldError id={dateErrorId} message={dateError} />
        </div>
      )}
      <TimeChips
        office={office}
        date={date}
        value={time}
        onChange={(value) => {
          clearMessages();
          setLost(null);
          setTime(value);
        }}
      />
      {seatMap.isPending ? (
        <Skeleton label="Loading spaces…" className="layout pad" />
      ) : seatMap.isError ? (
        <ErrorPanel error={seatMap.error} onRetry={() => seatMap.refetch()} />
      ) : (
        <SeatMap
          seats={seats}
          selectedId={selectedId}
          lostId={lost?.id}
          currentId={booking.space.id}
          legend="change"
          label={`${booking.space.area ?? 'Desks'}, ${booking.space.floor}`}
          onPick={(seat) => {
            clearMessages();
            setSelectedId(seat.id === booking.space.id ? null : seat.id);
          }}
          onOpenMine={() => setRefusal({ message: 'You already have a desk that day. Pick another day, or change that booking.' })}
        />
      )}
      {lost && <Alert className="mt-3.5" message={lost.message} />}
      {refusal && <Alert className="mt-3.5" message={refusal.message} />}
      {!unchanged && !lost && (
        <Alert tone="info" className="mt-3.5" live={false}>
          Moving from{' '}
          <b>
            {booking.space.label}, {slotWords(oldSlot, oldFrom, oldTo)}
          </b>{' '}
          to{' '}
          <b>
            {newSeat ? newSeat.label : booking.space.label}, {slotWords(time.slot, time.from, time.to)}
          </b>
          , {date === booking.date ? 'same day' : formatDay(date)}. {booking.space.label} stays yours until you save; if the new
          seat or time is taken first, nothing changes.
        </Alert>
      )}
      <SaveRow bookingId={booking.id} disabled={unchanged || save.isPending} busy={save.isPending} onSave={() => save.mutate()} summary={`${newSeat ? `Seat ${newSeat.label}` : spaceShort(booking.space)} · ${formatDay(date)}`} />
    </>
  );
}

/** Room: the day bar with the time held now in ink ("Now") and the new pick in rose. */
function RoomChange({ booking, office, onSaved }) {
  const [date, setDate] = useState(booking.date);
  const [pick, setPick] = useState({ from: hhmm(booking.startTime), to: hhmm(booking.endTime) });
  const [refusal, setRefusal] = useState(null);
  const day = useQuery({ queryKey: keys.roomDay(booking.space.id, date), queryFn: () => getRoomDay(booking.space.id, date) });

  const save = useMutation({
    mutationFn: () => changeBooking(booking.id, { spaceId: booking.space.id, date, startTime: pick.from, endTime: pick.to }),
    onSuccess: onSaved,
    onError: (error) => {
      setRefusal(error);
      day.refetch();
    },
  });

  const unchanged = date === booking.date && pick.from === hhmm(booking.startTime) && pick.to === hhmm(booking.endTime);

  return (
    <>
      <p className="muted sm">
        {booking.space.label} · {formatDay(booking.date)} · now {formatRange(booking.startTime, booking.endTime)} {booking.timeZoneName}
      </p>
      <DateButton
        office={office}
        value={date}
        onChange={(value) => {
          setRefusal(null);
          setDate(value);
        }}
      />
      {day.isPending ? (
        <Skeleton label="Loading the room…" className="timeline" />
      ) : day.isError ? (
        <ErrorPanel error={day.error} onRetry={() => day.refetch()} />
      ) : (
        <div className="timeline" style={{ padding: '14px 14px 0' }}>
          <DayBar
            opensAt={day.data.opensAt}
            closesAt={day.data.closesAt}
            blocks={day.data.blocks}
            pick={unchanged ? null : pick}
            currentId={date === booking.date ? booking.id : undefined}
            label={`${booking.space.label} on ${formatDay(date)}`}
          />
          <RoomTimePick
            day={day.data}
            timeZone={booking.timeZone}
            value={pick}
            ignoreBookingId={booking.id}
            onChange={(value) => {
              setRefusal(null);
              setPick(value);
            }}
          />
        </div>
      )}
      {refusal && <Alert className="mt-3.5" message={refusal.message} />}
      {!unchanged && !refusal && (
        <Alert tone="info" className="mt-3.5" live={false}>
          Moving from <b>{formatRange(booking.startTime, booking.endTime)}</b> to <b>{formatRange(pick.from, pick.to)}</b>
          {date !== booking.date && ` on ${formatDay(date)}`}. Your current time stays yours until you save.
        </Alert>
      )}
      <SaveRow bookingId={booking.id} disabled={unchanged || save.isPending} busy={save.isPending} onSave={() => save.mutate()} summary={`${formatRange(pick.from, pick.to)} · ${formatDay(date)}`} />
    </>
  );
}

function SaveRow({ bookingId, disabled, busy, onSave, summary }) {
  return (
    <>
      <div className="row-flex reserve-btn" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
        <Link to={`/bookings/${bookingId}`} className="btn btn-text">
          Back
        </Link>
        <button type="button" className="btn btn-cta" disabled={disabled} onClick={onSave}>
          {busy ? 'Saving…' : 'Save change'}
        </button>
      </div>
      <div className="mbar">
        <div className="fill">
          <b className="sm">{summary}</b>
        </div>
        <button type="button" className="btn btn-cta btn-sm" style={{ padding: '10px 16px' }} disabled={disabled} onClick={onSave}>
          Save change
        </button>
      </div>
    </>
  );
}

/** /bookings/:id/change */
export function ChangeBookingPage() {
  usePageTitle('Change booking');
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const booking = useQuery({ queryKey: keys.booking(id), queryFn: () => getBooking(id) });
  const { office } = useOffice(booking.data?.space.officeId);

  function onSaved(changed) {
    invalidateBookingViews();
    showToast({ message: `Booking changed. We sent the confirmation again.`, action: { label: 'View', to: `/bookings/${changed.id}` } });
    navigate(`/bookings/${changed.id}`, { replace: true });
  }

  if (booking.isError && isPageError(booking.error)) {
    return <NotFoundPage />;
  }

  let body;
  if (booking.isPending || (booking.data && !office)) {
    body = <Skeleton label="Loading the booking…" lines={4} />;
  } else if (booking.isError) {
    body = <ErrorPanel error={booking.error} onRetry={() => booking.refetch()} />;
  } else if (!booking.data.actions.canChange) {
    body = (
      <div className="card pad">
        <Alert tone="warn" message="This booking can't be changed any more. A booking can be changed only until it starts." />
        <Link to={`/bookings/${id}`} className="btn btn-line" style={{ marginTop: 14 }}>
          Back to the booking
        </Link>
      </div>
    );
  } else {
    const Change = booking.data.space.type === 'DESK' ? DeskChange : RoomChange;
    body = (
      <div className="card pad" style={{ minWidth: 0 }}>
        <Link className="back" to={`/bookings/${id}`}>
          <IconArrowLeft aria-hidden="true" /> Booking
        </Link>
        <h1 style={{ fontSize: 22, margin: '6px 0 4px' }}>Change booking</h1>
        <Change booking={booking.data} office={office} onSaved={onSaved} />
      </div>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="page" style={{ maxWidth: 980 }}>
        {body}
      </main>
    </>
  );
}
