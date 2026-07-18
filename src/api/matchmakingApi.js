import { gameEngineClient } from './gameEngineClient';

export const matchmakingApi = {
  joinQueue: (userId) => gameEngineClient.post('/api/matchmaking/join', { userId }),
  leaveQueue: (userId) => gameEngineClient.post('/api/matchmaking/leave', { userId }),
};
