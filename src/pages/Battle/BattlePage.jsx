import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useMatch } from '../../hooks/useMatch';
import { useToast } from '../../hooks/useToast';
import { usePreloadedAssets } from '../../hooks/usePreloadedAssets';
import { gameApi } from '../../api/gameApi';
import { deckApi } from '../../api/deckApi';
import { CANVAS_HEIGHT, canvasToGame } from '../../utils/coordinates';
import { isValidDeployCanvasPos } from '../../utils/deployment';
import { updateHud } from '../../components/MatchCanvas/drawBoard';
import { MatchCanvas } from '../../components/MatchCanvas/MatchCanvas';
import { Spinner } from '../../components/Spinner/Spinner';
import { Button } from '../../components/Button/Button';
import { FormError } from '../../components/FormError/FormError';
import { Hand } from '../../components/Hand/Hand';
import { ElixirBar } from '../../components/ElixirBar/ElixirBar';
import './BattlePage.css';

function getCanvasPos(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

const fetchOwnDeck = () => deckApi.getMyActiveDeck();

export default function BattlePage() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const { match, setMatch, clearMatch } = useMatch();
  const { connect, subscribe, send } = useWebSocket();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // 'recovering' | 'ready' | 'error' — solo se usan para la recuperación de
  // myTeam al entrar directo por URL; la carga de sprites la maneja aparte
  // usePreloadedAssets (ver uiPhase más abajo), en paralelo.
  const [phase, setPhase] = useState(match?.matchId === matchId ? 'ready' : 'recovering');
  const [recoveryError, setRecoveryError] = useState('');

  const myTeam = match?.matchId === matchId ? match.myTeam : null;

  const assets = usePreloadedAssets(fetchOwnDeck);
  const deckCardsById = assets.cardsById;

  // La mano solo cambia cuando el motor reparte/retira una carta, no cada
  // snapshot: se actualiza vía setState pero solo cuando el contenido
  // realmente difiere (ver el efecto de suscripción más abajo).
  const [handCardIds, setHandCardIds] = useState([]);
  const [nextCardId, setNextCardId] = useState(null);

  const [selectedCardId, setSelectedCardId] = useState(null);
  const [dragCardId, setDragCardId] = useState(null);

  // Debug: alterna sprites <-> formas geométricas (tecla D).
  const [useSprites, setUseSprites] = useState(true);

  const canvasRef = useRef(null);
  const snapshotRef = useRef(null);
  const lastHandKeyRef = useRef('');
  const pointerPosRef = useRef(null);
  const spellEffectsRef = useRef([]);

  const timerRef = useRef(null);
  const myElixirTargetRef = useRef(0);
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

  const uiPhase =
    phase === 'error' ? 'error' : phase !== 'ready' ? 'recovering' : assets.phase === 'error' ? 'error' : assets.phase !== 'ready' ? 'loading' : 'ready';
  const errorMessage = phase === 'error' ? recoveryError : assets.error;

  // Suscripción al snapshot de la partida (100ms). Se guarda en un ref: 10
  // renders de React por segundo sería tirar rendimiento a la basura, el
  // canvas se redibuja solo con requestAnimationFrame (ver MatchCanvas). La
  // mano es la única parte del snapshot que sí dispara un render de React,
  // y solo cuando cambia de verdad.
  useEffect(() => {
    if (uiPhase !== 'ready' || !myTeam) return undefined;

    let cancelled = false;
    let subscription;

    async function watchMatch() {
      await connect();
      if (cancelled) return;
      subscription = subscribe(`/topic/match/${matchId}`, (snapshot) => {
        snapshotRef.current = snapshot;

        const me = snapshot.players?.find((p) => p.userId === user.id);
        if (!me) return;

        const hand = me.handCardIds ?? [];
        const handKey = `${hand.join(',')}|${me.nextCardId ?? ''}`;
        if (handKey !== lastHandKeyRef.current) {
          lastHandKeyRef.current = handKey;
          setHandCardIds(hand);
          setNextCardId(me.nextCardId ?? null);
        }
      });
    }

    watchMatch();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [uiPhase, myTeam, matchId, user.id, connect, subscribe]);

  // Errores de jugadas rechazadas por el motor (elixir insuficiente, carta
  // fuera de mano, posición inválida, etc.).
  useEffect(() => {
    if (uiPhase !== 'ready' || !myTeam) return undefined;

    let cancelled = false;
    let subscription;

    async function watchErrors() {
      await connect();
      if (cancelled) return;
      subscription = subscribe(`/topic/match/${matchId}/errors/${user.id}`, (payload) => {
        showToast({ variant: 'error', message: payload?.reason || 'Jugada rechazada.', duration: 3000 });
      });
    }

    watchErrors();

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [uiPhase, myTeam, matchId, user.id, connect, subscribe, showToast]);

  const handleFrame = useCallback(
    (snapshot) => {
      updateHud(snapshot, myTeam, { timerRef, myElixirTargetRef, opponentElixirRef, overlayRef, overlayTextRef }, user.id);
    },
    [myTeam, user.id],
  );

  // Atajos de teclado: 1-4 seleccionan la carta de esa posición en la mano,
  // Escape deselecciona / cancela el arrastre en curso, D alterna
  // sprites/formas geométricas (debug).
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setSelectedCardId(null);
        setDragCardId(null);
        return;
      }
      if (e.key === 'd' || e.key === 'D') {
        setUseSprites((prev) => !prev);
        return;
      }
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx === -1) return;
      const cardId = handCardIds[idx];
      if (cardId == null) return;
      setDragCardId(null);
      setSelectedCardId((prev) => (prev === cardId ? null : cardId));
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handCardIds]);

  function playCard(cardId, gamePos) {
    try {
      send(`/app/match/${matchId}/play`, { playerId: user.id, cardId, x: gamePos.x, y: gamePos.y });
    } catch (err) {
      showToast({ variant: 'error', message: err.message || 'No se pudo jugar la carta.' });
    }
  }

  function tryDeploy(cardId, canvasPos) {
    const card = deckCardsById[cardId];
    if (!card) return;
    if (!isValidDeployCanvasPos(canvasPos.x, canvasPos.y, card.deploymentType)) {
      showToast({ variant: 'warning', message: 'No puedes desplegar esa carta ahí.', duration: 2000 });
      return;
    }

    const gamePos = canvasToGame(canvasPos.x, canvasPos.y, myTeam);
    playCard(cardId, gamePos);

    if (card.type === 'SPELL') {
      spellEffectsRef.current = [
        ...spellEffectsRef.current,
        { cardName: card.name, x: gamePos.x, y: gamePos.y, startedAt: performance.now() },
      ];
    }
  }

  function handleCanvasClick(e) {
    if (!selectedCardId) return;
    const pos = getCanvasPos(e, canvasRef.current);
    tryDeploy(selectedCardId, pos);
    setSelectedCardId(null);
  }

  function handleCanvasMouseMove(e) {
    pointerPosRef.current = getCanvasPos(e, canvasRef.current);
  }

  function handleCanvasMouseLeave() {
    pointerPosRef.current = null;
  }

  function handleCanvasDragOver(e) {
    if (dragCardId == null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    pointerPosRef.current = getCanvasPos(e, canvasRef.current);
  }

  function handleCanvasDrop(e) {
    e.preventDefault();
    const cardId = Number(e.dataTransfer.getData('text/plain'));
    const pos = getCanvasPos(e, canvasRef.current);
    setDragCardId(null);
    pointerPosRef.current = null;
    if (Number.isFinite(cardId)) tryDeploy(cardId, pos);
  }

  function handleBackToMenu() {
    clearMatch();
    navigate('/menu');
  }

  if (uiPhase === 'recovering') {
    return (
      <div className="match-screen match-screen--center">
        <Spinner size="lg" />
        <p className="match-screen__status">Recuperando la partida...</p>
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
        <Button type="button" onClick={() => navigate('/menu')}>
          Volver al menú
        </Button>
      </div>
    );
  }

  const handCards = handCardIds.map((id) => deckCardsById[id] ?? null);
  const nextCard = nextCardId != null ? deckCardsById[nextCardId] ?? null : null;
  const activeCardId = selectedCardId ?? dragCardId;
  const activeDeploymentType = activeCardId != null ? deckCardsById[activeCardId]?.deploymentType ?? null : null;

  return (
    <div className="match-screen">
      <div className="battle-layout">
        <div className="battle-board-column">
          <div className="match-canvas-wrap">
            <MatchCanvas
              canvasRef={canvasRef}
              snapshotRef={snapshotRef}
              myTeam={myTeam}
              spriteIndexRef={assets.spriteIndexRef}
              towerIndexRef={assets.towerIndexRef}
              bgImageRef={assets.bgImageRef}
              bgCropRef={assets.bgCropRef}
              useSprites={useSprites}
              activeDeploymentType={activeDeploymentType}
              pointerPosRef={pointerPosRef}
              spellEffectsRef={spellEffectsRef}
              onFrame={handleFrame}
              cursor={selectedCardId || dragCardId != null ? 'crosshair' : 'default'}
              onCanvasClick={handleCanvasClick}
              onCanvasMouseMove={handleCanvasMouseMove}
              onCanvasMouseLeave={handleCanvasMouseLeave}
              onCanvasDragOver={handleCanvasDragOver}
              onCanvasDrop={handleCanvasDrop}
            />

            <div ref={overlayRef} className="match-overlay" style={{ display: 'none' }}>
              <p ref={overlayTextRef} className="match-overlay__result" />
              <Button type="button" onClick={handleBackToMenu}>
                Volver al menú
              </Button>
            </div>
          </div>

          <Hand
            handCards={handCards}
            nextCard={nextCard}
            elixirRef={myElixirTargetRef}
            selectedCardId={selectedCardId}
            draggingCardId={dragCardId}
            onSelectCard={(cardId) => {
              setDragCardId(null);
              setSelectedCardId((prev) => (prev === cardId ? null : cardId));
            }}
            onDragStartCard={(cardId) => {
              setSelectedCardId(null);
              setDragCardId(cardId);
            }}
            onDragEndCard={() => setDragCardId(null)}
          />
        </div>

        <div className="battle-side-panel" style={{ height: CANVAS_HEIGHT }}>
          <span ref={timerRef} className="battle-hud__timer">
            0:00
          </span>

          <ElixirBar elixirRef={myElixirTargetRef} orientation="vertical" />

          <span ref={opponentElixirRef} className="battle-hud__elixir battle-hud__elixir--opponent">
            Rival: 0.0
          </span>
        </div>
      </div>
    </div>
  );
}
