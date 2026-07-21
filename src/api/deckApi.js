import { apiClient } from './client';

export const deckApi = {
  getMyActiveDeck: () => apiClient.get('/api/decks/my/active'),

  getAllCards: () => apiClient.get('/api/cards'),

  createDeck: (name, cardIds) => apiClient.post('/api/decks', { name, cardIds }),

  updateDeckCards: (deckId, cardIds) => apiClient.put(`/api/decks/${deckId}/cards`, { cardIds }),

  activateDeck: (deckId) => apiClient.put(`/api/decks/${deckId}/activate`),
};
