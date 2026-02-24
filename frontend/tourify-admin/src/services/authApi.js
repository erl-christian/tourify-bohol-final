import http from './httpClient';

export const login = (credentials) =>
  http.post('/accounts/login', credentials);

export const changePasswordFirstLogin = (payload, token) =>
  http.post('/accounts/change-password-first-login', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });