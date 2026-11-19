import { IconAdjustments, IconArmchair, IconBuilding, IconCalendarCog, IconChartBar, IconUsers } from '@tabler/icons-react';
import { NavLink, Outlet } from 'react-router';
import { AppHeader } from './AppHeader';

const LINKS = [
  { to: '/admin', label: 'Occupancy', Icon: IconChartBar, end: true },
  { to: '/admin/spaces', label: 'Spaces and seats', Icon: IconBuilding },
  { to: '/admin/rules', label: 'Booking rules', Icon: IconAdjustments },
  { to: '/admin/people', label: 'People and invites', Icon: IconUsers },
  { to: '/admin/bookings', label: 'All bookings', Icon: IconCalendarCog },
];

/** The admin shell: the same header with an Admin tag, and a 220 px left list (a scrolling row on a phone). */
export function AdminLayout() {
  return (
    <>
      <AppHeader admin />
      <div className="admin">
        <nav className="anav" aria-label="Admin">
          {LINKS.map(({ to, label, Icon, end }) => (
            // NavLink sets aria-current="page" on the active link.
            <NavLink key={to} to={to} end={end}>
              <Icon aria-hidden="true" /> {label}
            </NavLink>
          ))}
          <hr />
          <NavLink to="/home">
            <IconArmchair aria-hidden="true" /> Book for myself
          </NavLink>
        </nav>
        <main style={{ minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </>
  );
}
