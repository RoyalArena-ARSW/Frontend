import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePreloadedAssets } from '../../hooks/usePreloadedAssets';
import { replayApi } from '../../api/replayApi';
import { deckApi } from '../../api/deckApi';
import { formatTime, updateReadOnlyHud } from '../../components/MatchCanvas/drawBoard';
import { replayDuration, sampleSnapshot } from '../../utils/replayPlayback';
import { MatchCanvas } from '../../components/MatchCanvas/MatchCanvas';
import { MatchHud } from '../../components/MatchHud/MatchHud';
import { Spinner } from '../../components/Spinner/Spinner';
import { Button } from '../../components/Button/Button';
import { FormError } from '../../components/FormError/FormError';
import './ReplayPlayerPage.css';

const fetchAllCards = () => deckApi.getAllCards();
const DEFAULT_NAMES = { TEAM_A: 'Jugador A', TEAM_B: 'Jugador B' };
const SPEEDS = [1, 2, 4];

// Reproductor de replays: reutiliza MatchCanvas igual que la batalla y el
// espectador — la única diferencia es la fuente del snapshot. Acá no hay
// WebSocket: un temporizador en cliente avanza playbackRef según play/pausa
// y velocidad, interpola entre los dos snapshots que envuelven ese instante
// (ver utils/replayPlayback.js) y escribe el resultado en snapshotRef.
// MatchCanvas ni se entera de que no es un WebSocket.
export default function ReplayPlayerPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState('');
  const [replay, setReplay] = useState(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
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

  const currentTimeRef = useRef(null);
  const totalTimeRef = useRef(null);
  const scrubberRef = useRef(null);

  // Motor de reproducción, todo en refs: nada de esto necesita disparar un
  // render de React en cada frame (mismo espíritu que el resto del HUD).
  const playbackRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const draggingRef = useRef(false);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Trae el detalle completo de la replay (snapshots + resumen).
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');

    replayApi
      .getReplay(id)
      .then((data) => {
        if (cancelled) return;
        playbackRef.current = 0;
        setReplay(data);
        setPhase('ready');
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.status === 404 ? 'Esta repetición ya no existe.' : err.message || 'No se pudo cargar la repetición.');
          setPhase('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const names = useMemo(
    () =>
      replay
        ? { TEAM_A: replay.summary?.playerAName ?? 'Jugador A', TEAM_B: replay.summary?.playerBName ?? 'Jugador B' }
        : DEFAULT_NAMES,
    [replay],
  );

  const uiPhase =
    phase === 'error' ? 'error' : phase !== 'ready' ? 'loading' : assets.phase === 'error' ? 'error' : assets.phase !== 'ready' ? 'loading' : 'ready';
  const errorMessage = phase === 'error' ? loadError : assets.error;

  const snapshots = replay?.data?.snapshots ?? [];
  const duration = replay ? replayDuration(snapshots, replay.summary?.durationSeconds) : 0;

  // Avanza playbackRef según play/pausa y velocidad, muestrea+interpola el
  // snapshot correspondiente (utils/replayPlayback.js) y lo deja en
  // snapshotRef para que MatchCanvas lo dibuje en su propio loop. Al llegar
  // al final, pausa y deja el último snapshot (FINISHED) — eso ya dispara
  // el overlay de resultado vía updateReadOnlyHud, igual que en espectador.
  useEffect(() => {
    if (uiPhase !== 'ready') return undefined;

    if (totalTimeRef.current) totalTimeRef.current.textContent = formatTime(duration);
    snapshotRef.current = sampleSnapshot(snapshots, playbackRef.current);

    let frameId;
    let lastWallTime = performance.now();

    function tick(now) {
      frameId = requestAnimationFrame(tick);
      const deltaMs = now - lastWallTime;
      lastWallTime = now;

      if (playingRef.current && !draggingRef.current) {
        const next = playbackRef.current + (deltaMs / 1000) * speedRef.current;
        if (next >= duration) {
          playbackRef.current = duration;
          playingRef.current = false;
          setPlaying(false);
        } else {
          playbackRef.current = next;
        }
      }

      snapshotRef.current = sampleSnapshot(snapshots, playbackRef.current);

      if (currentTimeRef.current) currentTimeRef.current.textContent = formatTime(playbackRef.current);
      if (scrubberRef.current && !draggingRef.current) scrubberRef.current.value = String(playbackRef.current);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiPhase, snapshots, duration]);

  const handleFrame = useCallback(
    (snapshot) => {
      updateReadOnlyHud(snapshot, { timerRef, elixirARef, elixirBRef, crownsRef, overlayRef, overlayTextRef }, names);
    },
    [names],
  );

  // D alterna sprites/formas geométricas (debug, igual que batalla/espectador);
  // espacio hace play/pausa, como cualquier reproductor de video.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'd' || e.key === 'D') {
        setUseSprites((prev) => !prev);
      } else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((prev) => !prev);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function handleScrub(e) {
    const value = Number(e.target.value);
    playbackRef.current = value;
    snapshotRef.current = sampleSnapshot(snapshots, value);
    if (currentTimeRef.current) currentTimeRef.current.textContent = formatTime(value);
    draggingRef.current = false;
  }

  function handleRestart() {
    playbackRef.current = 0;
    snapshotRef.current = sampleSnapshot(snapshots, 0);
    if (scrubberRef.current) scrubberRef.current.value = '0';
    if (currentTimeRef.current) currentTimeRef.current.textContent = formatTime(0);
  }

  function handleBackToList() {
    navigate('/replays');
  }

  if (uiPhase === 'loading') {
    const pct = assets.progress.total > 0 ? Math.round((assets.progress.done / assets.progress.total) * 100) : 0;
    return (
      <div className="match-screen match-screen--center">
        <Spinner size="lg" />
        <p className="match-screen__status">Preparando la repetición...</p>
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
          Volver al historial
        </Button>
      </div>
    );
  }

  return (
    <div className="match-screen match-screen--column">
      <MatchHud
        badgeLabel="REPETICIÓN"
        badgeVariant="replay"
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
            Volver al historial
          </Button>
        </div>
      </div>

      <div className="replay-controls">
        <button type="button" className="replay-controls__icon-btn" onClick={handleRestart} aria-label="Reiniciar">
          ⟲
        </button>

        <button
          type="button"
          className="replay-controls__icon-btn replay-controls__icon-btn--primary"
          onClick={() => setPlaying((prev) => !prev)}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
        >
          {playing ? '❚❚' : '▶'}
        </button>

        <span ref={currentTimeRef} className="replay-controls__time">
          0:00
        </span>

        <input
          ref={scrubberRef}
          type="range"
          min={0}
          max={duration}
          step={0.1}
          defaultValue={0}
          className="replay-controls__scrubber"
          onMouseDown={() => {
            draggingRef.current = true;
          }}
          onTouchStart={() => {
            draggingRef.current = true;
          }}
          onChange={handleScrub}
          aria-label="Progreso de la repetición"
        />

        <span ref={totalTimeRef} className="replay-controls__time">
          0:00
        </span>

        <div className="replay-controls__speeds">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={`replay-controls__speed-btn${speed === s ? ' replay-controls__speed-btn--active' : ''}`}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
