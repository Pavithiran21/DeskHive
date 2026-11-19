import { zodResolver } from '@hookform/resolvers/zod';
import { IconCalendarSearch, IconCalendarX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router';
import { z } from 'zod';
import { adminCancel, listAllBookings } from '../../api/admin';
import { invalidateBookingViews, keys } from '../../api/queryClient';
import { Dialog } from '../../components/Dialog';
import { TextField } from '../../components/Fields';
import { Pager } from '../../components/Pager';
import { Alert, EmptyState, ErrorPanel, Skeleton } from '../../components/StatePanels';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useOffices } from '../../hooks/useOffices';
import { usePageTitle } from '../../hooks/usePageTitle';
import { applyFieldErrors } from '../../lib/apiErrors';
import { BOOKING_STATUSES, bookingTag, firstName, spaceShort } from '../../lib/bookingText';
import { formatDay, formatInstant, formatRange } from '../../lib/time';
import { useToast } from '../../toast/ToastContext';

/** A removed person keeps their name with a "Removed" tag; a deleted account is "Former employee". */
function PersonName({ person }) {
  return (
    <>
      <b>{person.name}</b> {person.tag === 'REMOVED' && <span className="tag t-gray">Removed</span>}
    </>
  );
}

function CancelWithReason({ booking, onClose }) {
  const { showToast } = useToast();
  const [refusal, setRefusal] = useState(null);
  const name = firstName(booking.person.name);
  const schema = z.object({
    reason: z.string().trim().min(1, `Add a short reason; ${name} will see it.`).max(200, 'Use at most 200 characters.'),
  });
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { reason: '' } });
  const mutation = useMutation({
    mutationFn: ({ reason }) => adminCancel(booking.id, { reason }),
    onSuccess: () => {
      invalidateBookingViews();
      showToast({ message: `Booking cancelled. ${name} was emailed.`, Icon: IconCalendarX });
      onClose(true);
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError)) {
        setRefusal(error);
        invalidateBookingViews();
      }
    },
  });
  return (
    <Dialog
      open
      onClose={() => onClose(false)}
      busy={mutation.isPending}
      title={`Cancel ${name}'s booking?`}
      description={`${spaceShort(booking.space)}, ${formatDay(booking.date)}, ${formatRange(booking.startTime, booking.endTime)} ${booking.timeZoneName}. ${name} gets an email with your reason.`}
      footer={
        <>
          <button type="button" className="btn btn-line" data-autofocus onClick={() => onClose(false)} disabled={mutation.isPending}>
            Keep booking
          </button>
          <button type="submit" form="admin-cancel" className="btn btn-danger" disabled={mutation.isPending}>
            {mutation.isPending ? 'Cancelling…' : 'Cancel and notify'}
          </button>
        </>
      }
    >
      <form
        id="admin-cancel"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setRefusal(null);
          mutation.mutate(values);
        })}
      >
        <TextField label="Reason" maxLength={200} error={form.formState.errors.reason?.message} {...form.register('reason')} />
      </form>
      {refusal && <Alert message={refusal.message} />}
    </Dialog>
  );
}

function BookingPane({ booking, onCancel }) {
  const tag = bookingTag(booking);
  const cancellable = !booking.ended && (booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN');
  return (
    <section className="card pad" aria-label="Booking">
      <div className="row-flex">
        <h2 className="fill" style={{ fontSize: 20 }}>
          {spaceShort(booking.space)} · {booking.space.floor}
        </h2>
        <span className={`tag ${tag.tone}`}>{tag.text}</span>
      </div>
      <dl className="dl tight" style={{ marginTop: 12 }}>
        <dt>Person</dt>
        <dd>
          <PersonName person={booking.person} />
          <div className="muted xs">{booking.person.email}</div>
        </dd>
        <dt>Date</dt>
        <dd>{formatDay(booking.date, { year: true })}</dd>
        <dt>Time</dt>
        <dd>
          {formatRange(booking.startTime, booking.endTime)} {booking.timeZoneName}
        </dd>
        <dt>Where</dt>
        <dd>{booking.space.office}</dd>
        <dt>Booked</dt>
        <dd>{formatInstant(booking.bookedAt, booking.timeZone)}</dd>
        {booking.cancellation && (
          <>
            <dt>Cancelled by</dt>
            <dd>{booking.cancellation.byName}</dd>
            {booking.cancellation.reason && (
              <>
                <dt>Reason</dt>
                <dd>{booking.cancellation.reason}</dd>
              </>
            )}
          </>
        )}
      </dl>
      {cancellable && (
        <>
          <button type="button" className="btn btn-line btn-red" style={{ marginTop: 16 }} onClick={onCancel}>
            Cancel booking
          </button>
          <p className="muted xs" style={{ marginTop: 8 }}>
            Shown until the booking ends. It asks for a reason and emails {firstName(booking.person.name)}.
          </p>
        </>
      )}
    </section>
  );
}

/** /admin/bookings: every booking, with filters; a row opens a view pane with "Cancel booking". */
export function AllBookingsPage() {
  usePageTitle('All bookings');
  const offices = useOffices();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const ids = { office: useId(), from: useId(), to: useId(), status: useId(), q: useId() };

  const filters = {
    officeId: params.get('office') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    status: params.get('status') ?? '',
    q: params.get('q') ?? '',
  };
  const page = Number(params.get('page') ?? 1);
  const q = useDebouncedValue(filters.q.trim());
  const query = { ...filters, q, page };
  const list = useQuery({
    queryKey: keys.allBookings(query),
    queryFn: () => listAllBookings({ ...query, officeId: query.officeId || undefined }),
    placeholderData: (previous) => previous,
  });

  function setFilter(name, value) {
    setSelected(null);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(name, value);
        else next.delete(name);
        if (name !== 'page') next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  const items = list.data?.items ?? [];
  const shown = selected ? (items.find((item) => item.id === selected.id) ?? selected) : null;
  const filtered = Object.values(filters).some(Boolean);

  let content;
  if (list.isPending) {
    content = <Skeleton className="pad" label="Loading bookings…" lines={5} />;
  } else if (list.isError) {
    content = <ErrorPanel error={list.error} onRetry={() => list.refetch()} title="Couldn't load bookings" />;
  } else if (!items.length) {
    content = (
      <EmptyState Icon={IconCalendarSearch} title={filtered ? 'No bookings match these filters' : 'No bookings yet'} text={filtered ? 'Try a wider date range or another status.' : 'Bookings show here as soon as people book.'}>
        {filtered && (
          <button type="button" className="btn btn-line" onClick={() => setParams({}, { replace: true })}>
            Clear filters
          </button>
        )}
      </EmptyState>
    );
  } else {
    content = (
      <div className={list.isPlaceholderData ? 'tablewrap stale' : 'tablewrap'} aria-busy={list.isFetching}>
        <table className="tbl cards">
          <thead>
            <tr>
              <th>Person</th>
              <th>Space</th>
              <th>Date</th>
              <th>Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((booking) => {
              const tag = bookingTag(booking);
              return (
                <tr key={booking.id} className={shown?.id === booking.id ? 'click on' : 'click'} onClick={() => setSelected(booking)}>
                  <td>
                    <button type="button" className="rowlink" onClick={() => setSelected(booking)}>
                      {booking.person.name}
                    </button>{' '}
                    {booking.person.tag === 'REMOVED' && <span className="tag t-gray">Removed</span>}
                  </td>
                  <td data-l="Space" className="nowrap">
                    {spaceShort(booking.space)} · {booking.space.floor}
                  </td>
                  <td data-l="Date" className="nowrap">{formatDay(booking.date)}</td>
                  <td data-l="Time" className="nowrap">
                    {formatRange(booking.startTime, booking.endTime)} {booking.timeZoneName}
                  </td>
                  <td>
                    <span className={`tag ${tag.tone}`}>{tag.text}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 14 }}>All bookings</h1>
      <div className="ab-split">
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 16px 0' }}>
            <div className="filters">
              <div>
                <label htmlFor={ids.office}>Office</label>
                <select id={ids.office} className="inp" value={filters.officeId} onChange={(event) => setFilter('office', event.target.value)}>
                  <option value="">All offices</option>
                  {(offices.data ?? []).map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={ids.from}>From</label>
                <input id={ids.from} className="inp" type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} />
              </div>
              <div>
                <label htmlFor={ids.to}>To</label>
                <input id={ids.to} className="inp" type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} />
              </div>
              <div>
                <label htmlFor={ids.status}>Status</label>
                <select id={ids.status} className="inp" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
                  <option value="">Any status</option>
                  {BOOKING_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fill">
                <label htmlFor={ids.q}>Person or space</label>
                <input
                  id={ids.q}
                  className="inp"
                  placeholder="Name, email or B7"
                  style={{ width: '100%' }}
                  value={filters.q}
                  onChange={(event) => setFilter('q', event.target.value)}
                />
              </div>
            </div>
          </div>
          {content}
          <Pager data={list.data} onPage={(next) => setFilter('page', String(next))} showSize />
        </div>
        <div style={{ minWidth: 0 }}>
          {shown ? (
            <BookingPane booking={shown} onCancel={() => setCancelling(shown)} />
          ) : (
            <div className="card pad muted sm">Pick a booking to see it here.</div>
          )}
        </div>
      </div>
      {cancelling && (
        <CancelWithReason
          booking={cancelling}
          onClose={(done) => {
            setCancelling(null);
            if (done) setSelected(null);
          }}
        />
      )}
    </>
  );
}
