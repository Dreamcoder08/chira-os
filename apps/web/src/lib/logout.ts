import { request } from './api.ts';

const key = 'chira.logoutPending';
export function logoutPending() {
  return localStorage.getItem(key) === '1';
}
export function markLogoutPending() {
  localStorage.setItem(key, '1');
}
export async function finishLogout() {
  if (!logoutPending()) return;
  await request('/api/auth/sign-out', undefined, {
    method: 'POST',
    body: '{}',
  });
  localStorage.removeItem(key);
}
