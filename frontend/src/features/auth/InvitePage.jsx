import { zodResolver } from '@hookform/resolvers/zod';
import { IconMailOff, IconUserCheck } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { acceptInvitation, getInvitation } from '../../api/auth';
import { homePathFor, useAuth } from '../../auth/AuthContext';
import { TextField } from '../../components/Fields';
import { Alert, ErrorPanel, Skeleton } from '../../components/StatePanels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { applyFieldErrors } from '../../lib/apiErrors';
import { initials } from '../../lib/bookingText';
import { nameField, newPasswordField, withConfirm } from '../../lib/schemas';
import { formatInstantDay } from '../../lib/time';
import { SingleCard } from './SingleCard';

const schema = withConfirm(z.object({ name: nameField, password: newPasswordField, confirm: z.string() }));

/** Expired, revoked or used: one answer, and it never says which of the three it was. */
function DeadInvitation() {
  return (
    <SingleCard className="card state">
      <IconMailOff className="big" aria-hidden="true" />
      <h1 style={{ fontSize: 19, marginTop: 8 }}>This invitation can't be used any more</h1>
      <p className="muted sm">It has expired, was revoked or was already used. Ask your admin to send a new one.</p>
      <Link to="/" className="btn btn-line">
        Go to Log in
      </Link>
    </SingleCard>
  );
}

/** /invite/:token from the invitation email: set a name and a password and join as an Employee. */
export function InvitePage() {
  usePageTitle('Join DeskHive');
  const { token } = useParams();
  const { user, signIn, signOut } = useAuth();
  const navigate = useNavigate();

  const invitation = useQuery({ queryKey: ['invitation', token], queryFn: () => getInvitation(token), retry: false });
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', password: '', confirm: '' } });
  const mutation = useMutation({
    mutationFn: ({ name, password }) => acceptInvitation(token, { name, password }),
    onSuccess: (session) => {
      signIn(session);
      navigate('/home', { replace: true });
    },
    onError: (error) => applyFieldErrors(error, form.setError),
  });

  if (invitation.isPending) {
    return (
      <SingleCard>
        <Skeleton className="" label="Opening your invitation…" />
      </SingleCard>
    );
  }
  if (invitation.error?.code === 'INVITE_NOT_VALID' || mutation.error?.code === 'INVITE_NOT_VALID') {
    return <DeadInvitation />;
  }
  if (invitation.isError) {
    return (
      <SingleCard className="">
        <ErrorPanel error={invitation.error} onRetry={() => invitation.refetch()} />
      </SingleCard>
    );
  }

  const invite = invitation.data;

  if (user) {
    return (
      <SingleCard className="card state">
        <IconUserCheck className="big" aria-hidden="true" />
        <h1 style={{ fontSize: 19, marginTop: 8 }}>You're already signed in as {user.name}</h1>
        <p className="muted sm">Log out to accept the invitation for {invite.email}.</p>
        <div className="row-flex">
          <Link to={homePathFor(user)} className="btn btn-text">
            Go to Home
          </Link>
          <button type="button" className="btn btn-cta" onClick={() => signOut()}>
            Log out and continue
          </button>
        </div>
      </SingleCard>
    );
  }

  const { errors } = form.formState;
  const otherError =
    mutation.isError && !Object.values(errors).some((entry) => entry.type === 'server') ? mutation.error : null;

  return (
    <SingleCard>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Join {invite.officeName}</h1>
      <div className="inviter">
        <span className="av av-admin" aria-hidden="true">
          {initials(invite.inviterName)}
        </span>
        <div className="sm">
          <b>{invite.inviterName} invited you.</b>
          <div className="muted xs">
            For {invite.email} · link expires {formatInstantDay(invite.expiresAt, invite.timeZone)}
          </div>
        </div>
      </div>
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <TextField label="Full name" autoComplete="name" error={errors.name?.message} {...form.register('name')} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          hint="At least 8 characters, with a number."
          {...form.register('password')}
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...form.register('confirm')}
        />
        {otherError && <Alert className="mb-3.5" message={otherError.message} />}
        <button type="submit" className="btn btn-cta btn-block" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating your account…' : 'Create account and join'}
        </button>
      </form>
    </SingleCard>
  );
}
