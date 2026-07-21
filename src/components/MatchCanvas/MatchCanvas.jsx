import { useEffect, useRef } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../../utils/coordinates';
import { AnimationController } from '../../utils/AnimationController';
import { drawBoard, drawDeployOverlay, drawSpellEffects, SPELL_EFFECT_DURATION_MS } from './drawBoard';
import './MatchCanvas.css';

/**
 * Canvas "puro" del tablero: en cada frame de requestAnimationFrame dibuja
 * arena, torres, unidades, sprites y animaciones a partir de
 * snapshotRef.current, sin saber de dónde sale ese snapshot. Batalla en
 * vivo, espectador y replay comparten este componente — solo se diferencian
 * en quién escribe snapshotRef (el WebSocket o el temporizador de
 * reproducción interpolado), si hay interacción de despliegue (solo
 * batalla), y la orientación (myTeam real en vivo, fija en espectador/replay).
 */
export function MatchCanvas({
  canvasRef,
  snapshotRef,
  myTeam,
  spriteIndexRef,
  towerIndexRef,
  bgImageRef,
  bgCropRef,
  useSprites,
  activeDeploymentType = null,
  pointerPosRef = null,
  spellEffectsRef = null,
  onFrame,
  onCanvasClick,
  onCanvasMouseMove,
  onCanvasMouseLeave,
  onCanvasDragOver,
  onCanvasDrop,
  cursor = 'default',
}) {
  const animationControllerRef = useRef(null);
  if (!animationControllerRef.current) animationControllerRef.current = new AnimationController();
  // Controller aparte para las torres: siempre son las mismas 6 (type+team),
  // nunca hace falta podarlas, así que no comparten el prune()-por-instanceId
  // del controller de unidades (eso las habría reseteado a cada frame).
  const towerAnimationControllerRef = useRef(null);
  if (!towerAnimationControllerRef.current) towerAnimationControllerRef.current = new AnimationController();

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');

    let frameId;
    let lastTime = performance.now();

    function draw(now) {
      frameId = requestAnimationFrame(draw);
      const deltaMs = now - lastTime;
      lastTime = now;

      const snapshot = snapshotRef.current;
      const controller = animationControllerRef.current;
      const towerController = towerAnimationControllerRef.current;
      controller.tick(deltaMs);
      towerController.tick(deltaMs);
      if (snapshot) {
        controller.prune(new Set((snapshot.units ?? []).map((u) => u.instanceId)));
      }

      const spriteCtx = {
        spriteIndex: spriteIndexRef.current,
        towerIndex: towerIndexRef.current,
        controller,
        towerController,
        useSprites,
      };

      drawBoard(ctx, snapshot, myTeam, { image: bgImageRef.current, crop: bgCropRef.current }, spriteCtx);
      onFrame?.(snapshot, now);

      if (spellEffectsRef) {
        spellEffectsRef.current = spellEffectsRef.current.filter((e) => now - e.startedAt < SPELL_EFFECT_DURATION_MS);
        if (useSprites) {
          drawSpellEffects(ctx, spellEffectsRef.current, myTeam, spriteIndexRef.current, now);
        }
      }

      if (pointerPosRef) {
        drawDeployOverlay(ctx, activeDeploymentType, pointerPosRef.current);
      }
    }

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [
    canvasRef,
    snapshotRef,
    myTeam,
    spriteIndexRef,
    towerIndexRef,
    bgImageRef,
    bgCropRef,
    useSprites,
    activeDeploymentType,
    pointerPosRef,
    spellEffectsRef,
    onFrame,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="match-canvas"
      style={{ cursor }}
      onClick={onCanvasClick}
      onMouseMove={onCanvasMouseMove}
      onMouseLeave={onCanvasMouseLeave}
      onDragOver={onCanvasDragOver}
      onDrop={onCanvasDrop}
    />
  );
}
