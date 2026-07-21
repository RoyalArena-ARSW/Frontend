import { apiClient } from './client';

export const replayApi = {
  getMyReplays: () => apiClient.get('/api/replays/my'),
  getReplay: (id) => apiClient.get(`/api/replays/${id}`),
};
