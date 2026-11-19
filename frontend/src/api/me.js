import { apiRequest } from './client';

export function getMe() {
  return apiRequest('/me');
}

export function updateMe({ name }) {
  return apiRequest('/me', { method: 'PATCH', body: { name } });
}

/** 200 { accessToken }: every other login of this person is ended. 400 WRONG_PASSWORD. */
export function changePassword({ currentPassword, newPassword }) {
  return apiRequest('/me/password', { method: 'POST', body: { currentPassword, newPassword } });
}

/** 204; 409 LAST_ADMIN; 403 DEMO_ACCOUNT_LOCKED; 400 WRONG_PASSWORD. */
export function deleteMe({ password }) {
  return apiRequest('/me', { method: 'DELETE', body: { password } });
}
