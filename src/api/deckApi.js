import { apiClient } from './client';

export const deckApi = {
  getActiveDeck: () => apiClient.get('/api/decks/my/active'),
};
