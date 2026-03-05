import http from './httpClient';

export const login = credentials =>
  http.post('/accounts/login', credentials);

export const changePasswordFirstLogin = (payload, token) =>
  http.post('/accounts/change-password-first-login', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });

// self account settings
export const fetchMyAccount = () =>
  http.get('/accounts/me');

export const updateMyAccount = payload =>
  http.patch('/accounts/me', payload);

export const changeMyPassword = payload =>
  http.patch('/accounts/me/password', payload);
