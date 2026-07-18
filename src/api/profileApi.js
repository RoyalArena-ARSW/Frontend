import { apiClient } from './client';

export const profileApi = {
  getMyProfile: () => apiClient.get('/api/profiles/me'),
};
