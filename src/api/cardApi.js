import { apiClient } from './client';

export const cardApi = {
  getAllCards: () => apiClient.get('/api/cards'),
};
