import { apiClient } from './client';

export const profileApi = {
  getMyProfile: () => apiClient.get('/api/profiles/me'),

  createProfile: ({ userId, displayName }) =>
    apiClient.post('/api/profiles', { userId, displayName }),

  // Actualización parcial: solo displayName, avatarUrl y favoriteCardId son editables.
  updateProfile: (patch) => apiClient.put('/api/profiles/me', patch),

  getLeaderboard: (limit = 20) => apiClient.get(`/api/profiles/leaderboard?limit=${limit}`),
};
