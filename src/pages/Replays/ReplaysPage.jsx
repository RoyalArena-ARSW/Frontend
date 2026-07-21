import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { replayApi } from '../../api/replayApi';
import { formatTime } from '../../components/MatchCanvas/drawBoard';
import { Spinner } from '../../components/Spinner/Spinner';
import { FormError } from '../../components/FormError/FormError';
import './ReplaysPage.css';

function formatRelativeTime(ms) {
  const diffMs = Date.now() - ms;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `hace ${diffWeeks} semana${diffWeeks > 1 ? 's' : ''}`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `hace ${diffMonths} mes${diffMonths > 1 ? 'es' : ''}`;
  const diffYears = Math.floor(diffDays / 365);
  return `hace ${diffYears} año${diffYears > 1 ? 's' : ''}`;
}

/** Resultado de la replay visto desde el usuario autenticado, no desde TEAM_A/B. */
function myResult(replay, userId) {
  const myTeam = replay.playerAId === userId ? 'TEAM_A' : replay.playerBId === userId ? 'TEAM_B' : null;
  if (!myTeam || !replay.winnerTeam) return 'empate';
  return replay.winnerTeam === myTeam ? 'victoria' : 'derrota';
}

const RESULT_LABEL = { victoria: 'Ganaste', derrota: 'Perdiste', empate: 'Empate' };

export default function ReplaysPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [replays, setReplays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    replayApi
      .getMyReplays()
      .then((data) => {
        if (!cancelled) setReplays(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'No se pudo cargar tu historial de repeticiones.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="replays-screen">
      <header className="replays-header">
        <Link to="/menu" className="replays-back">
          ← Menú
        </Link>
        <h1 className="replays-title">Mis Repeticiones</h1>
        <p className="replays-subtitle">Tus últimas batallas, para revivirlas cuando quieras.</p>
      </header>

      {loading ? (
        <div className="replays-status">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <FormError message={error} />
      ) : replays.length === 0 ? (
        <div className="replays-empty">
          <p className="replays-empty__title">Aún no tienes repeticiones.</p>
          <p className="replays-empty__subtitle">Juega una partida y aparecerá aquí.</p>
        </div>
      ) : (
        <div className="replays-grid">
          {replays.map((r) => {
            const result = myResult(r, user.id);
            return (
              <button key={r.id} type="button" className="replay-card" onClick={() => navigate(`/replays/${r.id}`)}>
                <span className={`replay-card__result replay-card__result--${result}`}>{RESULT_LABEL[result]}</span>

                <p className="replay-card__players">
                  <span>{r.playerAName ?? 'Jugador'}</span>
                  <span className="replay-card__vs">vs</span>
                  <span>{r.playerBName ?? 'Jugador'}</span>
                </p>

                <div className="replay-card__stats">
                  <span className="replay-card__crowns">
                    {r.crownsA ?? 0} - {r.crownsB ?? 0}
                  </span>
                  <span className="replay-card__duration">{formatTime(r.durationSeconds)}</span>
                </div>

                <span className="replay-card__date">{formatRelativeTime(r.playedAtMs)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
