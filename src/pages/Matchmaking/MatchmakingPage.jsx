import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useMatch } from '../../hooks/useMatch';
import { matchmakingApi } from '../../api/matchmakingApi';
import { Spinner } from '../../components/Spinner/Spinner';
import { Button } from '../../components/Button/Button';
import { FormError } from '../../components/FormError/FormError';
import './MatchmakingPage.css';

const RESULT = {
  QUEUED: 'QUEUED',
  MATCHED: 'MATCHED',
  ALREADY_QUEUED: 'ALREADY_QUEUED',
  NO_ACTIVE_DECK: 'NO_ACTIVE_DECK',
  DECK_SERVICE_UNAVAILABLE: 'DECK_SERVICE_UNAVAILABLE',
};

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MatchmakingPage() {
  const { user } = useAuth();
  const { connect, subscribe } = useWebSocket();
  const { setMatch } = useMatch();
  const navigate = useNavigate();

  // 'connecting' | 'searching' | 'found' | 'blocked' | 'error'
  const [phase, setPhase] = useState('connecting');
  const [blockedReason, setBlockedReason] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [elapsed, setElapsed] = useState(0);

  // Si es true al desmontar/cancelar, el jugador sigue en la cola del
  // servidor y hay que sacarlo con /leave para que no quede fantasma.
  const queuedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let subscription;

    async function startMatchmaking() {
      try {
        await connect();
        if (cancelled) return;

        // CRÍTICO: la suscripción tiene que quedar activa antes del /join,
        // o podemos perdernos el MatchFoundDTO si el emparejamiento es
        // instantáneo.
        subscription = subscribe(`/topic/matchmaking/${user.id}`, (matchFound) => {
          queuedRef.current = false;
          setMatch(matchFound);
          setPhase('found');
          navigate(`/battle/${matchFound.matchId}`, { replace: true });
        });

        const { result } = await matchmakingApi.joinQueue(user.id);

        if (cancelled) {
          if (result === RESULT.QUEUED || result === RESULT.ALREADY_QUEUED) {
            matchmakingApi.leaveQueue(user.id).catch(() => {});
          }
          return;
        }

        if (result === RESULT.QUEUED || result === RESULT.ALREADY_QUEUED) {
          queuedRef.current = true;
          setPhase('searching');
        } else if (result === RESULT.MATCHED) {
          // La notificación con el matchId ya viene en camino por el socket.
          setPhase('found');
        } else if (result === RESULT.NO_ACTIVE_DECK) {
          setPhase('blocked');
          setBlockedReason(RESULT.NO_ACTIVE_DECK);
        } else if (result === RESULT.DECK_SERVICE_UNAVAILABLE) {
          setPhase('blocked');
          setBlockedReason(RESULT.DECK_SERVICE_UNAVAILABLE);
        } else {
          setPhase('error');
          setErrorMessage(`Respuesta inesperada del servidor: ${result}`);
        }
      } catch (err) {
        if (!cancelled) {
          setPhase('error');
          setErrorMessage(err.message || 'No se pudo conectar con el servidor de juego.');
        }
      }
    }

    startMatchmaking();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
      if (queuedRef.current) {
        queuedRef.current = false;
        matchmakingApi.leaveQueue(user.id).catch(() => {});
      }
    };
  }, [connect, subscribe, setMatch, navigate, user.id]);

  useEffect(() => {
    if (phase !== 'searching') return undefined;
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  async function handleCancel() {
    queuedRef.current = false;
    try {
      await matchmakingApi.leaveQueue(user.id);
    } catch {
      // no bloqueamos la salida por un error de red al cancelar
    }
    navigate('/menu');
  }

  return (
    <div className="matchmaking-screen">
      <div className="matchmaking-card">
        {phase === 'connecting' && (
          <>
            <Spinner size="lg" />
            <p className="matchmaking-status">Conectando con el servidor de juego...</p>
          </>
        )}

        {phase === 'searching' && (
          <>
            <Spinner size="lg" />
            <p className="matchmaking-status">Buscando oponente...</p>
            <p className="matchmaking-timer">{formatElapsed(elapsed)}</p>
            <Button type="button" variant="secondary" onClick={handleCancel}>
              Cancelar
            </Button>
          </>
        )}

        {phase === 'found' && (
          <>
            <Spinner size="lg" />
            <p className="matchmaking-status">¡Rival encontrado! Preparando la partida...</p>
          </>
        )}

        {phase === 'blocked' && blockedReason === RESULT.NO_ACTIVE_DECK && (
          <div className="matchmaking-blocked">
            <h1>Necesitas un mazo</h1>
            <p>Para entrar a la cola necesitas tener un mazo activo con 8 cartas.</p>
            <Link to="/deck" className="matchmaking-blocked__link">
              Ir a mi mazo
            </Link>
          </div>
        )}

        {phase === 'blocked' && blockedReason === RESULT.DECK_SERVICE_UNAVAILABLE && (
          <div className="matchmaking-blocked">
            <h1>Servicio no disponible</h1>
            <p>El servicio de mazos no está disponible en este momento. Intenta de nuevo en unos segundos.</p>
          </div>
        )}

        {phase === 'error' && <FormError message={errorMessage} />}

        {(phase === 'blocked' || phase === 'error') && (
          <Link to="/menu" className="matchmaking-back-link">
            Volver al menú
          </Link>
        )}
      </div>
    </div>
  );
}
