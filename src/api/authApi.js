import { apiClient } from './client';

export const authApi = {
  register: ({ username, email, password }) =>
    apiClient.post('/api/auth/register', { username, email, password }),

  // identifier puede ser email o username
  login: ({ identifier, password }) =>
    apiClient.post('/api/auth/login', { identifier, password }),

  getMe: () => apiClient.get('/api/auth/me'),
};
