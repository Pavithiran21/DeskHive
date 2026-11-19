import { zodResolver } from '@hookform/resolvers/zod';
import { IconMailForward, IconMailPlus, IconUserX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { invite, listPeople, removeAccess, resendInvite, revokeInvite } from '../../api/admin';
import { keys, queryClient } from '../../api/queryClient';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Dialog } from '../../components/Dialog';
import { SelectField, TextField } from '../../components/Fields';
import { Pager } from '../../components/Pager';
import { Alert, EmptyState, ErrorPanel, Skeleton } from '../../components/StatePanels';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useOffices } from '../../hooks/useOffices';
import { usePageTitle } from '../../hooks/usePageTitle';
import { applyFieldErrors } from '../../lib/apiErrors';
import { firstName, LOCKED_REASON_TEXT, PEOPLE_STATUS } from '../../lib/bookingText';
import { emailField } from '../../lib/schemas';
import { formatInstantDay } from '../../lib/time';
import { useToast } from '../../toast/ToastContext';

const inviteSchema = z.object({ email: emailField, officeId: z.string().min(1, 'Pick an office.') });

// These refusals are about the email typed, so they go under the Email field, as the design draws them.
const EMAIL_CODES = new Set(['EMAIL_TAKEN', 'INVITE_PENDING', 'ACCESS_REMOVED']);

const refreshPeople = () => queryClient.invalidateQueries({ queryKey: ['admin', 'people'] });

function InviteDialog({ open, onClose, offices }) {
  const { showToast } = useToast();
  const [refusal, setRefusal] = useState(null);
  const form = useForm({ resolver: zodResolver(inviteSchema), defaultValues: { email: '', officeId: String(offices[0]?.id ?? '') } });
  const mutation = useMutation({
    mutationFn: ({ email, officeId }) => invite({ email, officeId: Number(officeId) }),
    onSuccess: (person) => {
      refreshPeople();
      showToast({ message: `Invitation sent to ${person.email}`, Icon: IconMailForward });
      close();
    },
    onError: (error) => {
      if (EMAIL_CODES.has(error.code)) {
        form.setError('email', { type: 'server', message: error.message }, { shouldFocus: true });
      } else if (!applyFieldErrors(error, form.setError)) {
        setRefusal(error);
      }
    },
  });

  function close() {
    form.reset();
    setRefusal(null);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={mutation.isPending}
      title="Invite people"
      footer={
        <>
          <button type="button" className="btn btn-text" onClick={close} disabled={mutation.isPending}>
            Cancel
          </button>
          <button type="submit" form="invite-form" className="btn btn-cta" disabled={mutation.isPending}>
            {mutation.isPending ? 'Sending…' : 'Send invitation'}
          </button>
        </>
      }
    >
      <form
        id="invite-form"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setRefusal(null);
          mutation.mutate(values);
        })}
        style={{ marginTop: 12 }}
      >
        <TextField label="Work email" type="email" data-autofocus error={form.formState.errors.email?.message} {...form.register('email')} />
        <SelectField
          label="Office"
          options={offices.map((office) => ({ value: String(office.id), label: office.name }))}
          error={form.formState.errors.officeId?.message}
          {...form.register('officeId')}
        />
        <p className="muted xs">New people join as Employees. The invitation link works once and expires in 7 days.</p>
        {refusal && <Alert className="mt-3" message={refusal.message} />}
      </form>
    </Dialog>
  );
}

function PersonActions({ person, onRemove, onResend, onRevoke, busyId }) {
  const busy = busyId === person.id;
  if (person.canRemove) {
    return (
      <button type="button" className="btn btn-text btn-sm btn-red" onClick={() => onRemove(person)}>
        <IconUserX aria-hidden="true" /> Remove access
      </button>
    );
  }
  if (person.status === 'INVITE_PENDING' || person.status === 'INVITE_EXPIRED') {
    return (
      // inline-flex follows the cell's alignment: right in the table, left in the phone cards.
      <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={() => onResend(person)} aria-label={`Resend the invitation to ${person.email}`}>
          Resend
        </button>
        {person.status === 'INVITE_PENDING' && (
          <button type="button" className="btn btn-text btn-sm" disabled={busy} onClick={() => onRevoke(person)} aria-label={`Revoke the invitation to ${person.email}`}>
            Revoke
          </button>
        )}
      </span>
    );
  }
  if (person.lockedReason) {
    return <span className="muted xs">{LOCKED_REASON_TEXT[person.lockedReason] ?? ''}</span>;
  }
  return null;
}

/** The email, or for an invitation when its link expires (in the person's office zone). */
function personSubline(person, offices) {
  const zone = offices?.find((office) => office.id === person.officeId)?.timeZone ?? 'UTC';
  if (person.status === 'INVITE_PENDING') return `Invite expires ${formatInstantDay(person.inviteExpiresAt, zone)}`;
  if (person.status === 'INVITE_EXPIRED') return `Invite expired ${formatInstantDay(person.inviteExpiresAt, zone)}`;
  return person.email;
}

/** /admin/people: the team, their status, and invite / resend / revoke / remove access. */
export function PeoplePage() {
  usePageTitle('People and invites');
  const { showToast } = useToast();
  const offices = useOffices();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState(null);
  const q = useDebouncedValue(search.trim());
  const params = { q: q || undefined, page };
  const people = useQuery({ queryKey: keys.people(params), queryFn: () => listPeople(params), placeholderData: (previous) => previous });

  // A refusal here (422 INVALID_STATUS: the row was out of date) reloads the list and says why.
  const onRowError = (error) => {
    refreshPeople();
    showToast({ message: error.message, error: true });
  };
  const resend = useMutation({
    mutationFn: (person) => resendInvite(person.invitationId),
    onSuccess: (person) => {
      refreshPeople();
      showToast({ message: `Invitation sent to ${person.email}`, Icon: IconMailForward });
    },
    onError: onRowError,
  });
  const revoke = useMutation({
    mutationFn: (person) => revokeInvite(person.invitationId),
    onSuccess: (_, person) => {
      refreshPeople();
      showToast({ message: `Invitation to ${person.email} revoked` });
    },
    onError: onRowError,
  });
  const remove = useMutation({
    mutationFn: (person) => removeAccess(person.id),
    onSuccess: (person) => {
      refreshPeople();
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
      setRemoving(null);
      showToast({ message: `${person.name}'s access removed`, Icon: IconUserX });
    },
  });
  const busyId = resend.isPending ? resend.variables?.id : revoke.isPending ? revoke.variables?.id : null;

  const items = people.data?.items ?? [];
  let content;
  if (people.isPending) {
    content = <Skeleton className="pad" label="Loading people…" lines={4} />;
  } else if (people.isError) {
    content = <ErrorPanel error={people.error} onRetry={() => people.refetch()} title="Couldn't load people" />;
  } else if (!items.length && !q) {
    content = (
      <EmptyState logo title="No people yet" text="Invite your team and they can start booking straight away.">
        <button type="button" className="btn btn-cta" onClick={() => setInviteOpen(true)}>
          <IconMailPlus aria-hidden="true" /> Invite people
        </button>
      </EmptyState>
    );
  } else if (!items.length) {
    content = <p className="pad muted sm">Nobody matches “{q}”.</p>;
  } else {
    content = (
      <div className={people.isPlaceholderData ? 'tablewrap stale' : 'tablewrap'} aria-busy={people.isFetching}>
        <table className="tbl cards">
          <thead>
            <tr>
              <th>Person</th>
              <th>Role</th>
              <th>Status</th>
              <th className="num">Bookings this week</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((person) => {
              const status = PEOPLE_STATUS[person.status] ?? { text: person.status, tone: 't-gray' };
              const invited = person.status === 'INVITE_PENDING' || person.status === 'INVITE_EXPIRED';
              return (
                <tr key={person.id}>
                  <td>
                    <b>{invited ? person.email : person.name}</b>
                    <div className="muted xs" style={{ overflowWrap: 'anywhere' }}>
                      {personSubline(person, offices.data)}
                    </div>
                  </td>
                  <td data-l="Role">{person.role === 'ADMIN' ? 'Admin' : 'Employee'}</td>
                  <td>
                    <span className={`tag ${status.tone}`}>{status.text}</span>
                  </td>
                  <td className="num" data-l="Bookings this week">
                    {invited || person.status === 'REMOVED' ? '—' : person.bookingsThisWeek}
                  </td>
                  <td className="num">
                    <PersonActions
                      person={person}
                      busyId={busyId}
                      onRemove={(row) => {
                        remove.reset();
                        setRemoving(row);
                      }}
                      onResend={(row) => resend.mutate(row)}
                      onRevoke={(row) => revoke.mutate(row)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const name = removing ? firstName(removing.name) : '';
  return (
    <>
      <h1 style={{ fontSize: 24, marginBottom: 14 }}>People and invites</h1>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="row-flex" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <b className="fill">{people.data ? `${people.data.totalItems} people and invitations` : 'People'}</b>
          <input
            className="inp"
            style={{ margin: 0, width: 220, padding: '7px 12px', fontSize: 14 }}
            aria-label="Search people"
            placeholder="Search name or email"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <button type="button" className="btn btn-cta btn-sm" onClick={() => setInviteOpen(true)} disabled={!offices.data?.length}>
            <IconMailPlus aria-hidden="true" /> Invite people
          </button>
        </div>
        {content}
        <Pager data={people.data} onPage={setPage} showSize />
      </div>
      <div className="card pad" style={{ marginTop: 16, maxWidth: 760 }}>
        <b>Who can be removed</b>
        <p className="muted sm" style={{ marginTop: 6 }}>
          Employees only. Admins come from the seed script and can't be removed here. Removing is final: there is no Restore, and
          inviting the same email again is refused. Removed people stay in the list as “Removed”, so the reports keep their past
          bookings.
        </p>
      </div>
      {offices.data && <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} offices={offices.data} />}
      <ConfirmDialog
        open={Boolean(removing)}
        title={removing ? `Remove ${removing.name}'s access?` : ''}
        description={
          removing
            ? `${name} can't log in any more and ${name}'s upcoming bookings are cancelled. ${name}'s name stays on past bookings and in the reports, marked “Removed”. This can't be undone.`
            : ''
        }
        keepLabel="Keep access"
        confirmLabel="Remove access"
        busyLabel="Removing…"
        busy={remove.isPending}
        error={remove.error}
        onClose={() => setRemoving(null)}
        onConfirm={() => remove.mutate(removing)}
      />
    </>
  );
}
