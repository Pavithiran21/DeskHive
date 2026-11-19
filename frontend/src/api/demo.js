import { apiRequest } from './client';

// Exists only when the backend runs with DEMO_MODE=true; otherwise /api/demo answers 404.

/** { roles: [{ role, email }] } */
export function getDemo() {
  return apiRequest('/demo', { auth: false });
}

/** Logs in as the demo Employee or Admin: the same { user, accessToken } as a normal log-in. */
export function demoLogin(role) {
  return apiRequest('/demo/login', { method: 'POST', body: { role }, auth: false });
}
