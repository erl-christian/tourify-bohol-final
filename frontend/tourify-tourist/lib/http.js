import axios from 'axios';

const client = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
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
