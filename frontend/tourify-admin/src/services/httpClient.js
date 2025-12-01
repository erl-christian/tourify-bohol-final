import axios from 'axios';

const base =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ||
  (import.meta.env.DEV ? 'http://localhost:5001/api' : '/api');

const http = axios.create({
  baseURL: base,
  withCredentials: true, // keep true if backend uses cookies; false for pure JWT only
});

http.interceptors.request.use(config => {
  const token = sessionStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default http;
