import axios from 'axios';

const baseURL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'https://tourify-bohol-final.onrender.com/api'; // fallback for release builds

const client = axios.create({
  baseURL,
  timeout: 10000,
});

client.interceptors.response.use(
  r => r,
  error => Promise.reject(error.response?.data ?? error)
);

export const setAuthToken = token => {
  if (token) {
    client.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete client.defaults.headers.common.Authorization;
  }
};

export default client;
