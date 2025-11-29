import http from './httpClient';

export const login = (credentials) =>
  http.post('/accounts/login', credentials);
