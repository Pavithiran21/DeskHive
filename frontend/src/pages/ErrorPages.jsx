import { IconMapQuestion } from '@tabler/icons-react';
import { Link } from 'react-router';
import { homePathFor, useAuth } from '../auth/AuthContext';
import { LogoMark } from '../components/Logo';
import { ErrorPanel } from '../components/StatePanels';
import { usePageTitle } from '../hooks/usePageTitle';
import { AppHeader } from '../layout/AppHeader';

function Frame({ children, plain = false }) {
  const { user } = useAuth();
  if (!user) {
    return (
      <div className="single">
        <header>
          <Link to="/" className="word">
            <LogoMark /> DeskHive
          </Link>
        </header>
        <main className={plain ? undefined : 'card'} style={{ width: '100%', maxWidth: 520 }}>
          {children}
        </main>
      </div>
    );
  }
  return (
    <>
      <AppHeader />
      <main className="page" style={{ maxWidth: 640 }}>
        {plain ? children : <div className="card">{children}</div>}
      </main>
    </>
  );
}

/** An Employee opening an /admin page (the server answers 403 there too). The page keeps its own words. */
export function ForbiddenPage() {
  usePageTitle('For admins');
  return (
    <Frame>
      <div className="state">
        <LogoMark size={56} />
        <h1 style={{ fontSize: 19, marginTop: 8 }}>This page is for admins</h1>
        <p className="muted sm">
          Your account can't manage spaces, rules or people. Ask your workplace admin if something needs changing.
        </p>
        <Link to="/home" className="btn btn-line">
          Back to booking
        </Link>
      </div>
    </Frame>
  );
}

/** An unknown route, or a booking that isn't yours (the API answers 404 for both). */
export function NotFoundPage() {
  const { user } = useAuth();
  usePageTitle('Not found');
  return (
    <Frame>
      <div className="state">
        <IconMapQuestion className="big" aria-hidden="true" />
        <h1 style={{ fontSize: 19, marginTop: 8 }}>We can't find that page</h1>
        <p className="muted sm">The link may be old, or the booking was cancelled.</p>
        <Link to={user ? homePathFor(user) : '/'} className="btn btn-line">
          {user ? 'Go to Home' : 'Go to Log in'}
        </Link>
      </div>
    </Frame>
  );
}

/** A query that failed with a 5xx or no connection, as a whole page. */
export function ServerErrorPage({ error, onRetry }) {
  return (
    <Frame plain>
      <ErrorPanel error={error} onRetry={onRetry} />
    </Frame>
  );
}
