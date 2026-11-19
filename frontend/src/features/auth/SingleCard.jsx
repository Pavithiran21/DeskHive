import { Link } from 'react-router';
import { LogoMark } from '../../components/Logo';

/** Invitation, /demo, Forgot and Reset password: one white card on a light grey page, logo above it. */
export function SingleCard({ children, className = 'card pad' }) {
  return (
    <div className="single">
      <header>
        <Link to="/" className="word">
          <LogoMark /> DeskHive
        </Link>
      </header>
      <main className={className}>{children}</main>
    </div>
  );
}
