import { zodResolver } from '@hookform/resolvers/zod';
import { IconMail } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { forgotPassword } from '../../api/auth';
import { TextField } from '../../components/Fields';
import { Alert } from '../../components/StatePanels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { applyFieldErrors } from '../../lib/apiErrors';
import { emailField } from '../../lib/schemas';
import { SingleCard } from './SingleCard';

const schema = z.object({ email: emailField });

/** Forgot password: the same "Check your inbox" answer whether or not the email has an account. */
export function ForgotPasswordPage() {
  usePageTitle('Reset your password');
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  const mutation = useMutation({
    mutationFn: ({ email }) => forgotPassword(email),
    onError: (error) => applyFieldErrors(error, form.setError),
  });
  const placedInline = mutation.error && form.formState.errors.email?.type === 'server';

  return (
    <SingleCard>
      <h1 style={{ fontSize: 20 }}>Reset your password</h1>
      <p className="muted sm" style={{ margin: '4px 0 14px' }}>
        We'll email you a link. It works once and expires in 30 minutes.
      </p>
      <form onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <TextField
          label="Work email"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <button type="submit" className="btn btn-dark btn-block" disabled={mutation.isPending}>
          {mutation.isPending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      {mutation.isSuccess && (
        <Alert tone="info" Icon={IconMail} className="mt-3.5" message="Check your inbox. If an account uses that email, a link is on its way." />
      )}
      {mutation.isError && !placedInline && <Alert className="mt-3.5" message={mutation.error.message} />}
      <p className="muted xs" style={{ marginTop: 14 }}>
        <Link to="/">Back to Log in</Link>
      </p>
    </SingleCard>
  );
}
