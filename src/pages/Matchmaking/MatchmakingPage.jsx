import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useMatch } from '../../hooks/useMatch';
import { useToast } from '../../hooks/useToast';
import { matchmakingApi } from '../../api/matchmakingApi';
import { Spinner } from '../../components/Spinner/Spinner';
import { Button } from '../../components/Button/Button';
import './MatchmakingPage.css';

const RESULT = {
  QUEUED: 'QUEUED',
  MATCHED: 'MATCHED',
  ALREADY_QUEUED: 'ALREADY_QUEUED',
  NO_ACTIVE_DECK: 'NO_ACTIVE_DECK',
  DECK_SERVICE_UNAVAILABLE: 'DECK_SERVICE_UNAVAILABLE',
};

const CONNECTION_ERROR_MESSAGE = 'No se pudo conectar con el servidor de partidas. ¿Está encendido el Game Engine?';

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MatchmakingPage() {
  const { user } = useAuth();
  const { connect, subscribe } = useWebSocket();
  const { setMatch } = useMatch();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // 'connecting' | 'searching' | 'found' — los resultados que impiden jugar
  // se avisan con un toast y vuelven al menú, no se quedan en esta pantalla.
  const [phase, setPhase] = useState('connecting');
  const [elapsed, setElapsed] = useState(0);

  // Si es true al desmontar/cancelar, el jugador sigue en la cola del
  // servidor y hay que sacarlo con /leave para que no quede fantasma.
  const queuedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let subscription;

    function goToMenuWithError(message) {
      showToast({ variant: 'error', message });
      navigate('/menu', { replace: true });
    }

    async function startMatchmaking() {
      try {
        await connect();
      } catch {
        if (!cancelled) goToMenuWithError(CONNECTION_ERROR_MESSAGE);
        return;
      }
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

      let result;
      try {
        ({ result } = await matchmakingApi.joinQueue(user.id));
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof TypeError ? CONNECTION_ERROR_MESSAGE : err.message || CONNECTION_ERROR_MESSAGE;
        goToMenuWithError(message);
        return;
      }

      if (cancelled) {
        if (result === RESULT.QUEUED || result === RESULT.ALREADY_QUEUED) {
          matchmakingApi.leaveQueue(user.id).catch(() => {});
        }
        return;
      }

      if (result === RESULT.QUEUED) {
        queuedRef.current = true;
        setPhase('searching');
      } else if (result === RESULT.ALREADY_QUEUED) {
        queuedRef.current = true;
        setPhase('searching');
        showToast({ variant: 'info', message: 'Ya estás buscando partida.' });
      } else if (result === RESULT.MATCHED) {
        // La notificación con el matchId ya viene en camino por el socket.
        setPhase('found');
      } else if (result === RESULT.NO_ACTIVE_DECK) {
        showToast({
          variant: 'warning',
          message: 'Necesitas un mazo activo para jugar. Ve a la sección Mazo y arma el tuyo.',
          action: { label: 'Ir a mi mazo', onClick: () => navigate('/deck') },
        });
        navigate('/menu', { replace: true });
      } else if (result === RESULT.DECK_SERVICE_UNAVAILABLE) {
        goToMenuWithError('El servicio de mazos no está disponible en este momento. Intenta de nuevo en unos segundos.');
      } else {
        goToMenuWithError(`Respuesta inesperada del servidor: ${result}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect, subscribe, setMatch, showToast, navigate, user.id]);

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
      </div>
    </div>
  );
}
