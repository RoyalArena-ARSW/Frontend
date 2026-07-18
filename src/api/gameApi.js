import { gameEngineClient } from './gameEngineClient';

export const gameApi = {
  getMatch: (matchId) => gameEngineClient.get(`/api/games/${matchId}`),
};
