import { IconArmchair, IconBuilding } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router';
import { demoLogin } from '../../api/demo';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Skeleton } from '../../components/StatePanels';
import { usePageTitle } from '../../hooks/usePageTitle';
import { SingleCard } from './SingleCard';
import { useDemoInfo } from './useDemoAvailable';

const ROLES = [
  { role: 'EMPLOYEE', label: 'Log in as Employee', text: 'Find a seat, book, check in', Icon: IconArmchair },
  { role: 'ADMIN', label: 'Log in as Admin', text: 'Spaces, rules, people, reports', Icon: IconBuilding },
];

/** /demo, only in demo mode: one button per role, each logging in as that demo account. */
export function DemoPage() {
  usePageTitle('Try the demo');
  const { signIn } = useAuth();
  const demo = useDemoInfo();
  const mutation = useMutation({ mutationFn: demoLogin, onSuccess: (session) => signIn(session) });

  if (demo.isPending) {
    return (
      <SingleCard>
        <Skeleton className="" label="Loading the demo…" />
      </SingleCard>
    );
  }

  if (demo.isError) {
    return (
      <SingleCard className="card state">
        <h1 style={{ fontSize: 19 }}>The demo isn't on</h1>
        <p className="muted sm">This DeskHive doesn't run in demo mode. Log in with your own account.</p>
        <Link to="/" className="btn btn-line">
          Go to Log in
        </Link>
      </SingleCard>
    );
  }

  return (
    <SingleCard>
      <h1 style={{ fontSize: 20 }}>Try DeskHive</h1>
      <p className="muted sm" style={{ marginTop: 4 }}>
        Demo data at Northwind Bengaluru. Each button logs you in as that role.
      </p>
      <div className="demo-roles">
        {ROLES.map(({ role, label, text, Icon }) => (
          <button key={role} type="button" disabled={mutation.isPending} onClick={() => mutation.mutate(role)}>
            <Icon aria-hidden="true" />
            <b>{label}</b>
            <span>{text}</span>
          </button>
        ))}
      </div>
      {mutation.isError && <Alert className="mb-4" message={mutation.error.message} />}
      <p className="muted xs">
        Demo accounts can't change their email or password, or delete the account. <Link to="/">Back to Log in</Link>
      </p>
    </SingleCard>
  );
}
