import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useMatch } from '../../hooks/useMatch';
import { gameApi } from '../../api/gameApi';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../utils/coordinates';
import { drawBoard, updateHud } from './drawBoard';
import { Spinner } from '../../components/Spinner/Spinner';
import { Button } from '../../components/Button/Button';
import { FormError } from '../../components/FormError/FormError';
import './BattlePage.css';

const ARENA_BG_SRC = '/assets/arena/level_jungle_arena_out/level_jungle_arena_sprite_00.png';

export default function BattlePage() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const { match, setMatch, clearMatch } = useMatch();
  const { connect, subscribe } = useWebSocket();
  const navigate = useNavigate();

  // 'recovering' | 'ready' | 'error' — solo se usa para la carga inicial;
  // el resto del juego se dibuja en el canvas sin pasar por React state.
  const [phase, setPhase] = useState(match?.matchId === matchId ? 'ready' : 'recovering');
  const [recoveryError, setRecoveryError] = useState('');

  const myTeam = match?.matchId === matchId ? match.myTeam : null;

  const canvasRef = useRef(null);
  const snapshotRef = useRef(null);
  const bgImageRef = useRef(null);

  const timerRef = useRef(null);
  const myElixirRef = useRef(null);
  const opponentElixirRef = useRef(null);
  const overlayRef = useRef(null);
  const overlayTextRef = useRef(null);

  // Si se entra directo por URL sin pasar por matchmaking, el MatchContext
  // está vacío: hay que recuperar la partida y deducir myTeam.
  useEffect(() => {
    if (match?.matchId === matchId) {
      setPhase('ready');
      return undefined;
    }

    let cancelled = false;
    setPhase('recovering');

    gameApi
      .getMatch(matchId)
      .then((data) => {
        if (cancelled) return;
        const me = (data.players ?? []).find((p) => p.userId === user.id);
        if (!me) {
          throw new Error('No formas parte de esta partida.');
        }
        const opponent = (data.players ?? []).find((p) => p.userId !== user.id);
        setMatch({ matchId: data.matchId ?? matchId, opponentId: opponent?.userId ?? null, yourTeam: me.team });
        setPhase('ready');
      })
      .catch((err) => {
        if (!cancelled) {
          setRecoveryError(err.message || 'No se pudo recuperar la partida.');
          setPhase('error');
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    const img = new Image();
    img.src = ARENA_BG_SRC;
    bgImageRef.current = img;
  }, []);

  // Suscripción al snapshot de la partida (100ms). Se guarda en un ref: 10
  // renders de React por segundo sería tirar rendimiento a la basura, el
  // canvas se redibuja solo con requestAnimationFrame.
  useEffect(() => {
    if (phase !== 'ready' || !myTeam) return undefined;

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
  }, [phase, myTeam, matchId, connect, subscribe]);

  useEffect(() => {
    if (phase !== 'ready' || !myTeam) return undefined;

    const ctx = canvasRef.current.getContext('2d');
    const hudRefs = { timerRef, myElixirRef, opponentElixirRef, overlayRef, overlayTextRef };
    let frameId;

    function draw() {
      frameId = requestAnimationFrame(draw);
      const snapshot = snapshotRef.current;
      drawBoard(ctx, snapshot, myTeam, bgImageRef.current);
      updateHud(snapshot, myTeam, hudRefs, user.id);
    }

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [phase, myTeam, user.id]);

  function handleBackToMenu() {
    clearMatch();
    navigate('/menu');
  }

  if (phase === 'recovering') {
    return (
      <div className="battle-screen battle-screen--center">
        <Spinner size="lg" />
        <p className="battle-screen__status">Recuperando la partida...</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="battle-screen battle-screen--center">
        <FormError message={recoveryError} />
        <Button type="button" onClick={() => navigate('/menu')}>
          Volver al menú
        </Button>
      </div>
    );
  }

  return (
    <div className="battle-screen">
      <div className="battle-hud">
        <span ref={myElixirRef} className="battle-hud__elixir battle-hud__elixir--me">
          Elixir: 0.0
        </span>
        <span ref={timerRef} className="battle-hud__timer">
          0:00
        </span>
        <span ref={opponentElixirRef} className="battle-hud__elixir battle-hud__elixir--opponent">
          Rival: 0.0
        </span>
      </div>

      <div className="battle-canvas-wrap">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="battle-canvas" />

        <div ref={overlayRef} className="battle-overlay" style={{ display: 'none' }}>
          <p ref={overlayTextRef} className="battle-overlay__result" />
          <Button type="button" onClick={handleBackToMenu}>
            Volver al menú
          </Button>
        </div>
      </div>
    </div>
  );
}
