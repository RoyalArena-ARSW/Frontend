import { useContext } from 'react';
import { ProfileContext } from '../context/ProfileContext';

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile debe usarse dentro de <ProfileProvider>');
  }
  return ctx;
}
