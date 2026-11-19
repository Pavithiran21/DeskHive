import { createContext, useContext } from 'react';

/**
 * { user, isLoading, sessionEnded, signIn(session), signOut(), setUser(user) }
 * user is the API's user ({ id, name, email, role, office, demo, onlyAdmin, companyName }) or null.
 */
export const AuthContext = createContext(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}

export const isAdmin = (user) => user?.role === 'ADMIN';

/** Where a person lands after logging in: Admins on Occupancy, Employees on Home. */
export function homePathFor(user) {
  return isAdmin(user) ? '/admin' : '/home';
}
