const FRAME_DURATION_MS = 125; // ~8 fps, independiente del tick del backend (100ms) y del canvas (60fps)
const DEATH_FADE_MS = 400;

/**
 * Estado de animación por unidad (instanceId): índice de frame actual y
 * acumulador de tiempo, avanzados a ~8fps sin importar cuántos snapshots
 * lleguen o a qué framerate se redibuje el canvas.
 */
export class AnimationController {
  constructor() {
    this.states = new Map();
  }

  /** Avanza el reloj de animación de todas las unidades vivas. Llamar una vez por frame de canvas. */
  tick(deltaMs) {
    for (const state of this.states.values()) {
      state.elapsed += deltaMs;
      while (state.elapsed >= FRAME_DURATION_MS) {
        state.elapsed -= FRAME_DURATION_MS;
        state.frameIndex += 1;
      }
    }
  }

  #stateFor(instanceId, action) {
    let state = this.states.get(instanceId);
    if (!state || state.action !== action) {
      // Cambio de acción (walk -> attack, etc.): reinicia desde el primer frame.
      state = { action, frameIndex: 0, elapsed: 0, deadSince: null };
      this.states.set(instanceId, state);
    }
    return state;
  }

  /** Índice de frame ya acotado a frameCount para esta unidad y acción. */
  getFrameIndex(instanceId, action, frameCount) {
    if (!frameCount) return 0;
    const state = this.#stateFor(instanceId, action);
    return state.frameIndex % frameCount;
  }

  /** Opacidad de fade-out: 1 mientras viva, decae a 0 en DEATH_FADE_MS desde que isDead se vuelve true. */
  getOpacity(instanceId, isDead) {
    if (!isDead) return 1;
    const state = this.states.get(instanceId);
    if (!state) return 1;
    if (state.deadSince == null) state.deadSince = performance.now();
    const elapsed = performance.now() - state.deadSince;
    return Math.max(0, 1 - elapsed / DEATH_FADE_MS);
  }

  /** Descarta el estado de unidades que ya no están en el snapshot, o el mapa crece sin límite durante la partida. */
  prune(aliveInstanceIds) {
    for (const id of this.states.keys()) {
      if (!aliveInstanceIds.has(id)) this.states.delete(id);
    }
  }
}
