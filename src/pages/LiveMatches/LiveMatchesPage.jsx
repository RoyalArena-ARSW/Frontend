import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { gameApi } from '../../api/gameApi';
import { formatTime } from '../../components/MatchCanvas/drawBoard';
import { Spinner } from '../../components/Spinner/Spinner';
import { FormError } from '../../components/FormError/FormError';
import './LiveMatchesPage.css';

const REFRESH_MS = 5000;

export default function LiveMatchesPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await gameApi.getLiveMatches();
        if (cancelled) return;
        setMatches(Array.isArray(data) ? data : []);
        setError('');
      } catch (err) {
        if (!cancelled) setError(err.message || 'No se pudo cargar la lista de partidas en vivo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="live-screen">
      <header className="live-header">
        <Link to="/menu" className="live-back">
          ← Menú
        </Link>
        <h1 className="live-title">TV Royale</h1>
        <p className="live-subtitle">Batallas en curso, en vivo y sin filtro.</p>
      </header>

      {loading ? (
        <div className="live-status">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <FormError message={error} />
      ) : matches.length === 0 ? (
        <div className="live-empty">
          <p className="live-empty__title">Silencio en la arena...</p>
          <p className="live-empty__subtitle">
            Nadie está peleando ahora mismo. Vuelve en un rato o entra tú a dar espectáculo.
          </p>
        </div>
      ) : (
        <div className="live-grid">
          {matches.map((m) => (
            <button
              key={m.matchId}
              type="button"
              className="live-card"
              onClick={() => navigate(`/spectate/${m.matchId}`)}
            >
              <span className="live-card__badge">
                <span className="live-card__dot" aria-hidden="true" />
                EN VIVO
              </span>

              <p className="live-card__players">
                <span>{m.playerAName ?? 'Jugador'}</span>
                <span className="live-card__vs">vs</span>
                <span>{m.playerBName ?? 'Jugador'}</span>
              </p>

              <div className="live-card__stats">
                <span className="live-card__crowns">{m.crownsA ?? 0} - {m.crownsB ?? 0}</span>
                <span className="live-card__time">{formatTime(m.remainingSeconds)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
