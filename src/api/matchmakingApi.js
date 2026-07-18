import { apiClient } from './client';

export const matchmakingApi = {
  join: (userId) => apiClient.post('/api/matchmaking/join', { userId }),
};
