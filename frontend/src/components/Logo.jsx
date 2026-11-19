import { Link } from 'react-router';

/**
 * DeskHive's mark: one bold rose line, a hexagon roof (the hive) that becomes a desk top with two legs,
 * and a dot for the person in their seat. No tile around it.
 */
export function LogoMark({ size = 34, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <g fill="none" stroke="#e11d48" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 34V21L32 10.5 50 21v13" />
        <path d="M8 34h48" />
        <path d="M16 34v18M48 34v18" />
      </g>
      <circle cx="32" cy="24" r="5" fill="#e11d48" />
    </svg>
  );
}

/** The mark plus the "DeskHive" wordmark in ink, as a link. With wordmark={false} only the mark shows. */
export function Wordmark({ to = '/', size = 34, wordmark = true, className = 'word' }) {
  return (
    <Link to={to} className={className} aria-label={wordmark ? undefined : 'DeskHive home'}>
      <LogoMark size={size} />
      {wordmark && 'DeskHive'}
    </Link>
  );
}
