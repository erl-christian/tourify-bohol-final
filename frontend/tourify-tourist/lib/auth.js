import client from './http';

export const login = payload =>
  client.post('/accounts/login', payload)
    .then(res => res.data)
    .catch(err => {
      console.log('login error', err?.message, err?.response?.status, err?.response?.data);
      alert(`Login failed: ${err?.message || 'unknown'}`);
      throw err;
    });
export const register = payload => 
    client.post('/accounts/register', payload).then(res => res.data);

export const requestPasswordReset = email =>
    client.post('/accounts/forgot-password', { email }).then(res => res.data);

export const resetPassword = ({ otp, token, newPassword }) =>
    client.post('/accounts/reset-password', { otp, token, newPassword }).then(res => res.data);

export const requestEmailVerification = email =>
  client.post('/accounts/verify-email/request', { email }).then(res => res.data);

export const verifyEmail = ({ otp, token }) =>
  client.post('/accounts/verify-email', { otp, token }).then(res => res.data);
