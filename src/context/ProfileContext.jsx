import { createContext, useCallback, useEffect, useState } from 'react';
import { profileApi } from '../api/profileApi';
import { useAuth } from '../hooks/useAuth';

export const ProfileContext = createContext(null);

/**
 * Carga el perfil del usuario autenticado una sola vez y lo comparte entre
 * pantallas (Menu, Perfil, Ranking) en vez de pedirlo por cada una.
 */
export function ProfileProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await profileApi.getMyProfile();
      setProfile(data);
      return data;
    } catch (err) {
      setError(err.message || 'No se pudo cargar el perfil.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refresh().catch(() => {});
    } else {
      setProfile(null);
      setError('');
    }
  }, [isAuthenticated, refresh]);

  const updateProfile = useCallback(async (patch) => {
    const updated = await profileApi.updateProfile(patch);
    setProfile(updated);
    return updated;
  }, []);

  const value = { profile, loading, error, refresh, updateProfile };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
