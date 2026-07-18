import { useContext } from 'react';
import { MatchContext } from '../context/MatchContext';

export function useMatch() {
  const ctx = useContext(MatchContext);
  if (!ctx) {
    throw new Error('useMatch debe usarse dentro de <MatchProvider>');
  }
  return ctx;
}
