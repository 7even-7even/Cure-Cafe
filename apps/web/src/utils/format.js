export const ROLES = {
  ADMIN: 'ADMIN',
  DOCTOR: 'DOCTOR',
  DIETICIAN: 'DIETICIAN',
  KITCHEN_STAFF: 'KITCHEN_STAFF',
  DELIVERY_STAFF: 'DELIVERY_STAFF',
  PATIENT: 'PATIENT'
};

export const roleLabel = (role) => String(role || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
export const humanize = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
export const dateOnly = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
export const timeOnly = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
export const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export function apiError(error) {
  return error?.data?.message || error?.error || 'Something went wrong';
}

export function can(user, roles) {
  return Boolean(user && roles.includes(user.role));
}
