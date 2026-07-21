import { gameEngineClient } from './gameEngineClient';

export const gameApi = {
  getMatch: (matchId) => gameEngineClient.get(`/api/games/${matchId}`),
  getLiveMatches: () => gameEngineClient.get('/api/games/live'),
};
