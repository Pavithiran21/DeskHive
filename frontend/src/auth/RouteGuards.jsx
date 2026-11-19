import { Navigate, Outlet, useLocation } from 'react-router';
import { LoadingScreen } from '../components/StatePanels';
import { ForbiddenPage } from '../pages/ErrorPages';
import { homePathFor, isAdmin, useAuth } from './AuthContext';

/** Every page that needs a login. Without one you go to Log in, and back here afterwards. */
export function RequireSignedIn() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return <LoadingScreen />;
  }
  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

/**
 * The /admin pages. An Employee sees the 403 page "This page is for admins". This only decides what
 * is shown: the server refuses every admin request from an Employee with 403 anyway.
 */
export function RequireAdmin() {
  const { user } = useAuth();
  if (!isAdmin(user)) {
    return <ForbiddenPage />;
  }
  return <Outlet />;
}

/** Log in, /demo and Forgot password. Signed in, you go where you were going, or to your home page. */
export function GuestOnly() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return <LoadingScreen />;
  }
  if (user) {
    const from = location.state?.from;
    const target = from ? from.pathname + from.search : homePathFor(user);
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}
