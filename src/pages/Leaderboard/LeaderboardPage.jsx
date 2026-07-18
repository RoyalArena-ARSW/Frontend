import { useEffect, useState } from 'react';
import { profileApi } from '../../api/profileApi';
import { useProfile } from '../../hooks/useProfile';
import { TrophyBadge } from '../../components/TrophyBadge/TrophyBadge';
import { FormError } from '../../components/FormError/FormError';
import './LeaderboardPage.css';

export default function LeaderboardPage() {
  const { profile } = useProfile();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    profileApi
      .getLeaderboard(20)
      .then((data) => {
        if (!cancelled) setEntries(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'No se pudo cargar el ranking.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="leaderboard-screen">
      <div className="leaderboard-card">
        <h1 className="leaderboard-title">Ranking</h1>

        {error ? <FormError message={error} /> : null}

        {loading ? (
          <p className="leaderboard-status">Cargando...</p>
        ) : (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Jugador</th>
                <th>Trofeos</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={entry.id}
                  className={profile && entry.userId === profile.userId ? 'leaderboard-row--me' : ''}
                >
                  <td>{index + 1}</td>
                  <td>{entry.displayName}</td>
                  <td>
                    <TrophyBadge value={entry.currentTrophies} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
