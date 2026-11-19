import { apiRequest, toQuery } from './client';

// Admin only: an Employee gets 403 on every one of these (the server decides, not the UI).

export const createOffice = (body) => apiRequest('/admin/offices', { method: 'POST', body });
export const updateOffice = (id, { name, address }) =>
  apiRequest(`/admin/offices/${id}`, { method: 'PATCH', body: { name, address } });
export const deleteOffice = (id) => apiRequest(`/admin/offices/${id}`, { method: 'DELETE' });
export const saveRules = (id, body) => apiRequest(`/admin/offices/${id}/rules`, { method: 'PUT', body });

export const createFloor = ({ officeId, name }) =>
  apiRequest('/admin/floors', { method: 'POST', body: { officeId, name } });
export const renameFloor = (id, { name }) => apiRequest(`/admin/floors/${id}`, { method: 'PATCH', body: { name } });
export const deleteFloor = (id) => apiRequest(`/admin/floors/${id}`, { method: 'DELETE' });

export const listSpaces = ({ floorId, q, page, size = 20 }) =>
  apiRequest(`/admin/spaces${toQuery({ floorId, q, page, size })}`);
export const createDesk = (body) => apiRequest('/admin/desks', { method: 'POST', body });
export const updateDesk = (id, body) => apiRequest(`/admin/desks/${id}`, { method: 'PUT', body });
export const createRoom = (body) => apiRequest('/admin/rooms', { method: 'POST', body });
export const updateRoom = (id, body) => apiRequest(`/admin/rooms/${id}`, { method: 'PUT', body });
export const deleteSpace = (id) => apiRequest(`/admin/spaces/${id}`, { method: 'DELETE' });

export const listPeople = ({ q, page, size = 20 }) => apiRequest(`/admin/people${toQuery({ q, page, size })}`);
export const invite = ({ email, officeId }) =>
  apiRequest('/admin/invitations', { method: 'POST', body: { email, officeId } });
export const resendInvite = (id) => apiRequest(`/admin/invitations/${id}/resend`, { method: 'POST' });
export const revokeInvite = (id) => apiRequest(`/admin/invitations/${id}`, { method: 'DELETE' });
export const removeAccess = (id) => apiRequest(`/admin/people/${id}/remove`, { method: 'POST' });

export const listAllBookings = ({ officeId, from, to, status, q, page, size = 20 }) =>
  apiRequest(`/admin/bookings${toQuery({ officeId, from, to, status, q, page, size })}`);
export const adminCancel = (id, { reason }) =>
  apiRequest(`/admin/bookings/${id}/cancel`, { method: 'POST', body: { reason } });

export const getOccupancy = ({ officeId, floorId, weekStart, page, size = 20 }) =>
  apiRequest(`/admin/occupancy${toQuery({ officeId, floorId, weekStart, page, size })}`);
