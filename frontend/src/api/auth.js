import { apiRequest } from './client';

// Public endpoints: they never try to refresh on a 401 (auth: false). See BACKEND.md "Public".

export function login({ email, password }) {
  return apiRequest('/auth/login', { method: 'POST', body: { email, password }, auth: false });
}

export function logout() {
  return apiRequest('/auth/logout', { method: 'POST', auth: false });
}

export function forgotPassword(email) {
  return apiRequest('/auth/forgot-password', { method: 'POST', body: { email }, auth: false });
}

export function resetPassword({ token, password }) {
  return apiRequest('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false });
}

/** { email, inviterName, officeName, timeZone, expiresAt, companyName }; 400 INVITE_NOT_VALID for a dead link. */
export function getInvitation(token) {
  return apiRequest(`/invitations/${encodeURIComponent(token)}`, { auth: false });
}

export function acceptInvitation(token, { name, password }) {
  return apiRequest(`/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    body: { name, password },
    auth: false,
  });
}
