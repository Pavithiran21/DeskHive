import { IconAlertCircle, IconAlertTriangle, IconInfoCircle, IconPlugConnectedX } from '@tabler/icons-react';
import { splitLead } from '../lib/apiErrors';
import { LogoMark } from './Logo';

/** The first screen while the session is being restored. */
export function LoadingScreen() {
  return (
    <div className="single" aria-busy="true">
      <div className="word" style={{ marginTop: '30vh' }}>
        <LogoMark />
        DeskHive
      </div>
      <p className="muted sm">Loading…</p>
    </div>
  );
}

/** Grey skeleton lines and blocks; the shimmer stops under prefers-reduced-motion. */
export function Skeleton({ label = 'Loading…', blocks = 0, lines = 3, className = 'card pad' }) {
  return (
    <div className={className} aria-busy="true">
      <b className="sm">{label}</b>
      <div style={{ marginTop: 10 }}>
        {Array.from({ length: blocks }, (_, index) => (
          <div key={`b${index}`} className="skel blk" />
        ))}
        {Array.from({ length: lines }, (_, index) => (
          <div key={`l${index}`} className="skel" style={{ width: `${70 - index * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

/** An empty state: an icon (or the logo), a title, one line and usually one button. */
export function EmptyState({ Icon, logo = false, title, text, children, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  return (
    <div className="card state">
      {logo ? <LogoMark size={52} /> : Icon && <Icon className="big gray" aria-hidden="true" />}
      <Heading>{title}</Heading>
      {text && <p className="muted sm">{text}</p>}
      {children && <div className="row-flex">{children}</div>}
    </div>
  );
}

/** "Something went wrong" with Try again and the request id (5xx or no connection). */
export function ErrorPanel({ error, onRetry, title = 'Something went wrong' }) {
  const offline = error?.status === 0;
  return (
    <div className="card state" role="alert">
      <IconPlugConnectedX className="big" aria-hidden="true" />
      <h2>{title}</h2>
      <p className="muted sm">{offline ? 'Check your connection and try again.' : "It's not you. Try again in a moment."}</p>
      {onRetry && (
        <div className="row-flex">
          <button type="button" className="btn btn-line" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
      {error?.requestId && <p className="muted xs" style={{ marginTop: 8 }}>Request ID: {error.requestId}</p>}
    </div>
  );
}

const ALERT_ICONS = { err: IconAlertTriangle, warn: IconAlertCircle, info: IconInfoCircle };

/**
 * An alert inside a card or dialog: the first sentence in bold, the rest after it.
 * tone: err (pale red), warn (amber) or info (blue).
 */
export function Alert({ tone = 'err', message, children, Icon, live = true, className = '', id }) {
  const Shown = Icon ?? ALERT_ICONS[tone];
  const [lead, rest] = message ? splitLead(message) : [null, null];
  return (
    <div className={`alert a-${tone} ${className}`} role={live ? (tone === 'info' ? 'status' : 'alert') : undefined} id={id}>
      <Shown aria-hidden="true" />
      <div>
        {message && (
          <>
            <b>{lead}</b> {rest}
          </>
        )}
        {children}
      </div>
    </div>
  );
}
