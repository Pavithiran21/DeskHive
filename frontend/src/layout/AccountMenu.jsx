import { IconCalendarEvent, IconChartBar, IconLogout, IconMenu2, IconSearch, IconUser } from '@tabler/icons-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { isAdmin, useAuth } from '../auth/AuthContext';
import { useDismiss } from '../hooks/useDismiss';
import { useIsPhone } from '../hooks/useMediaQuery';
import { initials } from '../lib/bookingText';

/**
 * The menu + avatar pill. On a desktop it opens a dropdown under the header; on a phone (below 860 px)
 * the same button opens a bottom sheet (a native <dialog>, so focus is trapped and Esc closes it).
 * It is a disclosure (a button that shows a list of links), so Tab moves through the links.
 */
export function AccountMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const wrapRef = useRef(null);
  const sheetRef = useRef(null);
  const listId = useId();

  const close = useCallback(() => setOpen(false), []);
  useDismiss(open && !isPhone, wrapRef, close, buttonRef);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) {
      return;
    }
    if (open && isPhone && !sheet.open) {
      sheet.showModal();
    } else if ((!open || !isPhone) && sheet.open) {
      sheet.close();
    }
  }, [open, isPhone]);

  useEffect(() => {
    if (open && !isPhone) {
      wrapRef.current?.querySelector('.dropdown a, .dropdown button')?.focus();
    }
  }, [open, isPhone]);

  async function handleLogout() {
    setOpen(false);
    await signOut();
    navigate('/', { replace: true });
  }

  const admin = isAdmin(user);
  const items = (
    <>
      {isPhone && (
        <Link to="/home" onClick={close}>
          <IconSearch aria-hidden="true" /> Find a space
        </Link>
      )}
      {admin && (
        <Link to="/admin" onClick={close} className={isPhone ? undefined : 'strong'}>
          <IconChartBar aria-hidden="true" /> Admin
        </Link>
      )}
      <Link to="/bookings" onClick={close} className={admin || isPhone ? undefined : 'strong'}>
        <IconCalendarEvent aria-hidden="true" /> My bookings
      </Link>
      <Link to="/profile" onClick={close}>
        <IconUser aria-hidden="true" /> Profile
      </Link>
      {!isPhone && <hr />}
      <button type="button" className="item" onClick={handleLogout}>
        <IconLogout aria-hidden="true" /> Log out
      </button>
    </>
  );

  return (
    <div ref={wrapRef} className="menu-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="menu"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${initials(user.name)}, account menu`}
        onClick={() => setOpen((value) => !value)}
      >
        <IconMenu2 aria-hidden="true" />
        <span className={admin ? 'av av-admin' : 'av'} aria-hidden="true">
          {initials(user.name)}
        </span>
      </button>
      {open && !isPhone && (
        <nav className="dropdown" id={listId} aria-label="Account">
          <div style={{ padding: '6px 16px 10px' }}>
            <b>{user.name}</b>
            <div className="muted xs" style={{ overflowWrap: 'anywhere' }}>
              {user.email}
            </div>
          </div>
          <hr />
          {items}
        </nav>
      )}
      <dialog ref={sheetRef} className="sheet-dlg" aria-label="Menu" id={isPhone ? listId : undefined} onClose={close}>
        {open && isPhone && (
          <nav aria-label="Account">
            <div className="grab" aria-hidden="true" />
            <div style={{ padding: '4px 20px 8px' }}>
              <b>{user.name}</b>
              <div className="muted xs" style={{ overflowWrap: 'anywhere' }}>
                {user.email}
              </div>
            </div>
            {items}
            <button type="button" className="btn btn-line btn-sm" style={{ margin: '8px 20px 0' }} onClick={close}>
              Close
            </button>
          </nav>
        )}
      </dialog>
    </div>
  );
}
