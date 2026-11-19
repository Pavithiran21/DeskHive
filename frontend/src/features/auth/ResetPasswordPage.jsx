import { zodResolver } from '@hookform/resolvers/zod';
import { IconClockX } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { resetPassword } from '../../api/auth';
import { TextField } from '../../components/Fields';
import { Alert } from '../../components/StatePanels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useToast } from '../../toast/ToastContext';
import { applyFieldErrors } from '../../lib/apiErrors';
import { newPasswordField, withConfirm } from '../../lib/schemas';
import { SingleCard } from './SingleCard';

const schema = withConfirm(z.object({ password: newPasswordField, confirm: z.string() }));

function DeadLink() {
  return (
    <Alert tone="err" Icon={IconClockX} className="mt-3.5" live>
      <b>This link can't be used any more.</b> Links work once and last 30 minutes.{' '}
      <Link to="/forgot-password">Send a new one</Link>
    </Alert>
  );
}

/** /reset-password?token=… from the email. A used, expired or unknown link gets one answer. */
export function ResetPasswordPage() {
  usePageTitle('Choose a new password');
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  const mutation = useMutation({
    mutationFn: ({ password }) => resetPassword({ token, password }),
    onSuccess: () => {
      showToast({ message: 'Password saved. Log in with your new password.' });
      navigate('/', { replace: true });
    },
    onError: (error) => applyFieldErrors(error, form.setError),
  });
  const { errors } = form.formState;
  const dead = !token || mutation.error?.code === 'RESET_LINK_EXPIRED';
  const otherError = mutation.isError && !dead && !Object.values(errors).some((entry) => entry.type === 'server');

  return (
    <SingleCard>
      <h1 style={{ fontSize: 20 }}>Choose a new password</h1>
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate style={{ marginTop: 14 }}>
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          hint="At least 8 characters, with a number."
          {...form.register('password')}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...form.register('confirm')}
        />
        <button type="submit" className="btn btn-dark btn-block" disabled={mutation.isPending || !token}>
          {mutation.isPending ? 'Saving…' : 'Save password'}
        </button>
      </form>
      {dead && <DeadLink />}
      {otherError && <Alert className="mt-3.5" message={mutation.error.message} />}
    </SingleCard>
  );
}
