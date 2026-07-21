import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { usePreloadedAssets } from '../../hooks/usePreloadedAssets';
import { gameApi } from '../../api/gameApi';
import { deckApi } from '../../api/deckApi';
import { updateReadOnlyHud } from '../../components/MatchCanvas/drawBoard';
import { MatchCanvas } from '../../components/MatchCanvas/MatchCanvas';
import { MatchHud } from '../../components/MatchHud/MatchHud';
import { Spinner } from '../../components/Spinner/Spinner';
import { Button } from '../../components/Button/Button';
import { FormError } from '../../components/FormError/FormError';

const fetchAllCards = () => deckApi.getAllCards();
const DEFAULT_NAMES = { TEAM_A: 'Jugador A', TEAM_B: 'Jugador B' };

// Ver una partida en curso sin jugarla: reutiliza MatchCanvas (mismo dibujo
// de tablero/torres/unidades/sprites que la batalla), suscrito de solo
// lectura al mismo topic /topic/match/{matchId} que usan los jugadores.
// Orientación fija (TEAM_A abajo): el espectador no tiene equipo propio.
export default function SpectatePage() {
  const { matchId } = useParams();
  const { connect, subscribe } = useWebSocket();
  const navigate = useNavigate();

  // 'recovering' | 'ready' | 'error' — confirma que la partida existe y
  // resuelve los nombres; la carga de sprites la maneja usePreloadedAssets
  // en paralelo (ver uiPhase).
  const [phase, setPhase] = useState('recovering');
  const [recoveryError, setRecoveryError] = useState('');
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [useSprites, setUseSprites] = useState(true);

  const assets = usePreloadedAssets(fetchAllCards);

  const canvasRef = useRef(null);
  const snapshotRef = useRef(null);
  const timerRef = useRef(null);
  const elixirARef = useRef(0);
  const elixirBRef = useRef(0);
  const crownsRef = useRef(null);
  const overlayRef = useRef(null);
  const overlayTextRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setPhase('recovering');

    Promise.all([gameApi.getMatch(matchId), gameApi.getLiveMatches().catch(() => [])])
      .then(([data, liveMatches]) => {
        if (cancelled) return;
        // Pinta el estado actual sin esperar el primer snapshot por WS.
        snapshotRef.current = data;

        const liveEntry = (liveMatches ?? []).find((m) => m.matchId === matchId);
        const players = data.players ?? [];
        const nameFor = (team, fallback) => {
          const player = players.find((p) => p.team === team);
          if (!player) return fallback;
          if (liveEntry?.playerAId === player.userId) return liveEntry.playerAName ?? fallback;
          if (liveEntry?.playerBId === player.userId) return liveEntry.playerBName ?? fallback;
          return fallback;
        };
        setNames({ TEAM_A: nameFor('TEAM_A', 'Jugador A'), TEAM_B: nameFor('TEAM_B', 'Jugador B') });
        setPhase('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setRecoveryError(
          err.status === 404 ? 'Esta partida ya terminó o ya no existe.' : err.message || 'No se pudo cargar la partida.',
        );
        setPhase('error');
      });

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const uiPhase =
    phase === 'error' ? 'error' : phase !== 'ready' ? 'recovering' : assets.phase === 'error' ? 'error' : assets.phase !== 'ready' ? 'loading' : 'ready';
  const errorMessage = phase === 'error' ? recoveryError : assets.error;

  useEffect(() => {
    if (uiPhase !== 'ready') return undefined;

    let cancelled = false;
    let subscription;

    async function watchMatch() {
      await connect();
      if (cancelled) return;
      subscription = subscribe(`/topic/match/${matchId}`, (snapshot) => {
        snapshotRef.current = snapshot;
      });
    }

    watchMatch();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [uiPhase, matchId, connect, subscribe]);

  const handleFrame = useCallback(
    (snapshot) => {
      updateReadOnlyHud(snapshot, { timerRef, elixirARef, elixirBRef, crownsRef, overlayRef, overlayTextRef }, names);
    },
    [names],
  );

  // Mismo atajo de debug que la batalla en vivo (tecla D).
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'd' || e.key === 'D') setUseSprites((prev) => !prev);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleBackToList() {
    navigate('/spectate');
  }

  if (uiPhase === 'recovering') {
    return (
      <div className="match-screen match-screen--center">
        <Spinner size="lg" />
        <p className="match-screen__status">Sintonizando la transmisión...</p>
      </div>
    );
  }

  if (uiPhase === 'loading') {
    const pct = assets.progress.total > 0 ? Math.round((assets.progress.done / assets.progress.total) * 100) : 0;
    return (
      <div className="match-screen match-screen--center">
        <Spinner size="lg" />
        <p className="match-screen__status">Cargando sprites...</p>
        <div className="match-load-bar">
          <div className="match-load-bar__fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="match-screen__status">{pct}%</p>
      </div>
    );
  }

  if (uiPhase === 'error') {
    return (
      <div className="match-screen match-screen--center">
        <FormError message={errorMessage} />
        <Button type="button" onClick={handleBackToList}>
          Volver a la lista
        </Button>
      </div>
    );
  }

  return (
    <div className="match-screen match-screen--column">
      <MatchHud
        badgeLabel="EN VIVO"
        badgeVariant="live"
        timerRef={timerRef}
        names={names}
        elixirARef={elixirARef}
        elixirBRef={elixirBRef}
        crownsRef={crownsRef}
      />

      <div className="match-canvas-wrap">
        <MatchCanvas
          canvasRef={canvasRef}
          snapshotRef={snapshotRef}
          myTeam="TEAM_A"
          spriteIndexRef={assets.spriteIndexRef}
          towerIndexRef={assets.towerIndexRef}
          bgImageRef={assets.bgImageRef}
          bgCropRef={assets.bgCropRef}
          useSprites={useSprites}
          onFrame={handleFrame}
        />

        <div ref={overlayRef} className="match-overlay" style={{ display: 'none' }}>
          <p ref={overlayTextRef} className="match-overlay__result" />
          <Button type="button" onClick={handleBackToList}>
            Volver a la lista
          </Button>
        </div>
      </div>
    </div>
  );
}
