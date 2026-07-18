import { apiClient } from './client';

export const deckApi = {
  getMyActiveDeck: () => apiClient.get('/api/decks/my/active'),

  getAllCards: () => apiClient.get('/api/cards'),
};
