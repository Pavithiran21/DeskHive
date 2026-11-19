import { zodResolver } from '@hookform/resolvers/zod';
import { IconLock } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { setAccessToken } from '../../api/client';
import { changePassword, deleteMe, updateMe } from '../../api/me';
import { useAuth } from '../../auth/AuthContext';
import { Dialog } from '../../components/Dialog';
import { TextField } from '../../components/Fields';
import { Alert } from '../../components/StatePanels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { AppHeader } from '../../layout/AppHeader';
import { applyFieldErrors } from '../../lib/apiErrors';
import { nameField, newPasswordField, withConfirm } from '../../lib/schemas';
import { zoneShortName } from '../../lib/time';
import { useToast } from '../../toast/ToastContext';

const detailsSchema = z.object({ name: nameField });
const passwordSchema = withConfirm(
  z.object({ currentPassword: z.string().min(1, 'Enter your password.'), newPassword: newPasswordField, confirm: z.string() }),
  'newPassword',
);
const deleteSchema = z.object({ password: z.string().min(1, 'Enter your password.') });

function DetailsCard({ user, onSaved }) {
  const { showToast } = useToast();
  // An error the form can't place under a field goes in an alert next to the button.
  const [error, setError] = useState(null);
  const form = useForm({ resolver: zodResolver(detailsSchema), defaultValues: { name: user.name } });
  const mutation = useMutation({
    mutationFn: updateMe,
    onSuccess: (updated) => {
      onSaved(updated);
      form.reset({ name: updated.name });
      showToast({ message: 'Details saved' });
    },
    onError: (failure) => {
      if (!applyFieldErrors(failure, form.setError)) setError(failure);
    },
  });
  const office = user.office ? `${user.office.name} (${zoneShortName(user.office.timeZone)})` : 'No office yet';
  return (
    <section className="card pad" aria-labelledby="details-h">
      <h2 id="details-h" style={{ fontSize: 19, marginBottom: 14 }}>
        Your details
      </h2>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setError(null);
          mutation.mutate(values);
        })}
      >
        <TextField label="Full name" autoComplete="name" error={form.formState.errors.name?.message} {...form.register('name')} />
        <TextField label="Email" value={user.email} readOnly hint="Your email is your login and can't be changed." />
        <TextField label="Office" value={office} readOnly />
        {error && <Alert className="mb-3.5" message={error.message} />}
        <button type="submit" className="btn btn-dark" disabled={mutation.isPending || !form.formState.isDirty}>
          {mutation.isPending ? 'Saving…' : 'Save details'}
        </button>
      </form>
    </section>
  );
}

function PasswordForm() {
  const { showToast } = useToast();
  // An error the form can't place under a field goes in an alert next to the button.
  const [error, setError] = useState(null);
  const form = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const { errors } = form.formState;
  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }) => changePassword({ currentPassword, newPassword }),
    onSuccess: (result) => {
      // The server ended every other login and gave this tab a new token and cookie.
      setAccessToken(result.accessToken);
      form.reset();
      showToast({ message: 'Password changed. Other devices were logged out.' });
    },
    onError: (failure) => {
      // WRONG_PASSWORD is a 400 with the field currentPassword: it goes under the field, never a log-out.
      if (!applyFieldErrors(failure, form.setError)) setError(failure);
    },
  });
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        setError(null);
        mutation.mutate(values);
      })}
    >
      <TextField
        label="Current password"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...form.register('currentPassword')}
      />
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        error={errors.newPassword?.message}
        hint="At least 8 characters, with a number."
        {...form.register('newPassword')}
      />
      <TextField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirm?.message}
        {...form.register('confirm')}
      />
      {error && <Alert className="mb-3.5" message={error.message} />}
      <button type="submit" className="btn btn-dark" disabled={mutation.isPending}>
        {mutation.isPending ? 'Changing…' : 'Change password'}
      </button>
    </form>
  );
}

function DeleteAccountDialog({ open, onClose, user }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  // An error the form can't place under a field goes in an alert next to the button.
  const [error, setError] = useState(null);
  const form = useForm({ resolver: zodResolver(deleteSchema), defaultValues: { password: '' } });
  const mutation = useMutation({
    mutationFn: deleteMe,
    onSuccess: async () => {
      await signOut();
      navigate('/', { replace: true });
    },
    onError: (failure) => {
      if (!applyFieldErrors(failure, form.setError)) setError(failure);
    },
  });

  function close() {
    form.reset();
    setError(null);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      busy={mutation.isPending}
      title="Delete your account?"
      description="Your upcoming bookings are cancelled and your name and email are removed. Past bookings stay in the office reports as “Former employee”."
      footer={
        <>
          <button type="button" className="btn btn-line" data-autofocus onClick={close} disabled={mutation.isPending}>
            Keep my account
          </button>
          <button type="submit" form="delete-account" className="btn btn-danger" disabled={mutation.isPending}>
            {mutation.isPending ? 'Deleting…' : 'Delete account'}
          </button>
        </>
      }
    >
      <form
        id="delete-account"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setError(null);
          mutation.mutate(values);
        })}
      >
        <TextField
          label="Enter your password to confirm"
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        {/* A hidden field so the browser's password manager knows whose password this is. */}
        <input type="hidden" name="username" value={user.email} autoComplete="username" />
      </form>
      {error && <Alert className="mb-3" message={error.message} />}
    </Dialog>
  );
}

/** /profile: name, change password, delete my account. Demo accounts and the only Admin see why they can't. */
export function ProfilePage() {
  usePageTitle('Profile');
  const { user, setUser } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const company = user.companyName ?? 'your company';

  return (
    <>
      <AppHeader />
      <main className="page" style={{ maxWidth: 1000 }}>
        <h1 style={{ fontSize: 26, marginBottom: 16 }}>Profile</h1>
        <div className="g2">
          <DetailsCard user={user} onSaved={(updated) => setUser(updated)} />
          <section className="card pad" aria-labelledby="password-h">
            <h2 id="password-h" style={{ fontSize: 19, marginBottom: 14 }}>
              Change password
            </h2>
            {user.demo ? (
              <Alert tone="warn" Icon={IconLock} live={false} message="Demo accounts can't change the password." />
            ) : (
              <PasswordForm />
            )}
            <hr className="divider" />
            <h2 style={{ fontSize: 17 }}>Delete my account</h2>
            <p className="muted sm" style={{ margin: '4px 0 12px' }}>
              Removes your name and email for good and cancels your upcoming bookings.
            </p>
            {user.demo ? (
              <Alert tone="warn" Icon={IconLock} live={false} message="Demo accounts can't be deleted." />
            ) : user.onlyAdmin ? (
              <>
                <button type="button" className="btn btn-line" disabled aria-describedby="only-admin">
                  Delete my account
                </button>
                <Alert tone="warn" Icon={IconLock} className="mt-3" live={false} id="only-admin">
                  <b>You're the only admin at {company},</b> so this account can't be deleted.
                </Alert>
              </>
            ) : (
              <button type="button" className="btn btn-line btn-red" onClick={() => setDeleteOpen(true)}>
                Delete my account
              </button>
            )}
          </section>
        </div>
        <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} user={user} />
      </main>
    </>
  );
}
