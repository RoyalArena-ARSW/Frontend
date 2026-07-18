import { createContext, useCallback, useState } from 'react';

export const MatchContext = createContext(null);

/**
 * Guarda la partida encontrada por matchmaking: matchId, opponentId y
 * myTeam. La pantalla de batalla necesita myTeam para saber cómo dibujar
 * el tablero (de qué lado está el jugador).
 */
export function MatchProvider({ children }) {
  const [match, setMatchState] = useState(null);

  const setMatch = useCallback((matchFound) => {
    setMatchState({
      matchId: matchFound.matchId,
      opponentId: matchFound.opponentId,
      myTeam: matchFound.yourTeam,
    });
  }, []);

  const clearMatch = useCallback(() => setMatchState(null), []);

  const value = { match, setMatch, clearMatch };

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>;
}
