import { SESSION_DAYS, SESSION_KEY } from '../constants/config';

export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!s?.phone || !s?.loginAt) return null;
    if (Date.now() - s.loginAt > SESSION_DAYS * 86400000) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveSession(m) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...m, loginAt: Date.now() }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
