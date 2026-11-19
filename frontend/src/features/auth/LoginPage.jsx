import { zodResolver } from '@hookform/resolvers/zod';
import { IconArmchair, IconClockPause, IconLockSquareRounded, IconMapPinCheck, IconUserOff } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { login } from '../../api/auth';
import { useAuth } from '../../auth/AuthContext';
import { TextField } from '../../components/Fields';
import { LogoMark } from '../../components/Logo';
import { Alert } from '../../components/StatePanels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { applyFieldErrors } from '../../lib/apiErrors';
import { emailField } from '../../lib/schemas';
import { useDemoAvailable } from './useDemoAvailable';

const schema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.'),
});

// The still picture on the right: an illustration of the seat map, not live data.
const PREVIEW_ROWS = [
  ['A', [1, 2, -3, -4, 0, 5, 6, -7, 8]],
  ['B', [-1, 2, 3, 4, 0, -5, 6, -7, 'sel8']],
  ['C', [1, 2, 3, -4, 0, 5, -6, 7, 8]],
];

function PreviewSeat({ value }) {
  if (value === 0) {
    return <span className="aisle" />;
  }
  if (value === 'sel8') {
    return <span className="s sel">8</span>;
  }
  return <span className={value < 0 ? 's x' : 's'}>{Math.abs(value)}</span>;
}

/** The start page at "/": a split screen with the form on white and a still product preview on grey. */
export function LoginPage() {
  usePageTitle('Log in');
  const { signIn, sessionEnded } = useAuth();
  const demoAvailable = useDemoAvailable();
  const [refusal, setRefusal] = useState(null);

  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });
  const { errors } = form.formState;

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (session) => signIn(session),
    onError: (error) => {
      if (applyFieldErrors(error, form.setError, { fallbackField: 'password' })) {
        setRefusal(null);
        return;
      }
      setRefusal(error);
    },
  });

  function onSubmit(values) {
    setRefusal(null);
    mutation.mutate(values);
  }

  return (
    <div className="auth">
      <main className="form">
        <Link className="word" to="/" style={{ fontSize: 24 }}>
          <LogoMark /> DeskHive
        </Link>
        <div className="box">
          <h1 style={{ fontSize: 30 }}>Log in</h1>
          <p className="muted" style={{ margin: '4px 0 22px' }}>
            Book a desk or a meeting room at your office.
          </p>
          {sessionEnded && !refusal && (
            <Alert tone="info" Icon={IconClockPause} className="mb-4" message="You've been logged out. Your session ended. Log in again to carry on." />
          )}
          {refusal && (
            <Alert
              tone={refusal.code === 'ACCESS_REMOVED' ? 'warn' : 'err'}
              Icon={refusal.code === 'ACCESS_REMOVED' ? IconUserOff : undefined}
              className="mb-4"
              message={refusal.message}
            />
          )}
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <TextField label="Work email" type="email" autoComplete="email" error={errors.email?.message} {...form.register('email')} />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...form.register('password')}
            />
            <button type="submit" className="btn btn-cta btn-block" style={{ padding: 13 }} disabled={mutation.isPending}>
              {mutation.isPending ? 'Logging in…' : 'Log in'}
            </button>
          </form>
          <div className="row-flex" style={{ justifyContent: 'space-between', marginTop: 14 }}>
            <Link to="/forgot-password" className="sm">
              Forgot password?
            </Link>
            {demoAvailable && (
              <Link to="/demo" className="sm">
                Try the demo
              </Link>
            )}
          </div>
          <hr className="divider" />
          <p className="muted xs">No account? DeskHive accounts are created by invitation. Ask your workplace admin to invite you.</p>
        </div>
      </main>
      <aside className="preview" aria-hidden="true">
        <div className="mock">
          <div className="row-flex" style={{ marginBottom: 12 }}>
            <b>Quiet zone · Floor 4</b>
            <span className="tag t-free" style={{ marginLeft: 'auto' }}>
              Full day
            </span>
          </div>
          {PREVIEW_ROWS.map(([row, seats]) => (
            <div key={row} className="srow">
              <span className="rl">{row}</span>
              {seats.map((value, index) => (
                <PreviewSeat key={index} value={value} />
              ))}
            </div>
          ))}
          <div className="screen">
            <div />
            <small>Windows this way</small>
          </div>
        </div>
        <h2 style={{ fontSize: 24 }}>Pick your seat the way you pick a cinema seat.</h2>
        <ul>
          <li>
            <IconArmchair />
            <span>See which desks and rooms are free on the days you come in.</span>
          </li>
          <li>
            <IconLockSquareRounded />
            <span>One seat, one person: two people can never book the same desk.</span>
          </li>
          <li>
            <IconMapPinCheck />
            <span>Check in when you arrive; unused seats go back to your team.</span>
          </li>
        </ul>
      </aside>
    </div>
  );
}
