import { homePathFor, useAuth } from '../auth/AuthContext';
import { Wordmark } from '../components/Logo';
import { AccountMenu } from './AccountMenu';

/**
 * The white header: logo and wordmark, the pill search in the middle (Home only, passed as `search`),
 * and the menu + avatar pill. Admin pages add the grey "Admin" tag.
 */
export function AppHeader({ search, admin = false }) {
  const { user } = useAuth();
  return (
    <header className="head">
      <Wordmark to={homePathFor(user)} />
      {admin && <span className="tag t-gray">Admin</span>}
      {search ?? <div className="spacer" />}
      <AccountMenu />
    </header>
  );
}
