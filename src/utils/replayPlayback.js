// Reproducción de replays: los snapshots llegan ~1 por segundo (cada 10
// ticks de 100ms), así que dibujarlos tal cual se ve a saltos — una unidad
// se mueve ~1 tile en ese segundo. Este módulo interpola linealmente la
// posición (x, y) de cada unidad entre el snapshot anterior y el siguiente
// según el progreso temporal, para que el movimiento se vea tan fluido como
// en vivo.

const TICK_SECONDS = 0.1;

function tickToSeconds(tick) {
  return tick * TICK_SECONDS;
}

/** Snapshots [a, b] que envuelven `seconds` (a === b en los bordes del array). */
function findBracket(snapshots, seconds) {
  if (snapshots.length === 0) return [null, null];
  if (seconds <= tickToSeconds(snapshots[0].tick)) return [snapshots[0], snapshots[0]];

  for (let i = 0; i < snapshots.length - 1; i += 1) {
    const tA = tickToSeconds(snapshots[i].tick);
    const tB = tickToSeconds(snapshots[i + 1].tick);
    if (seconds >= tA && seconds <= tB) return [snapshots[i], snapshots[i + 1]];
  }

  const last = snapshots[snapshots.length - 1];
  return [last, last];
}

/**
 * Interpola la posición de cada unidad entre dos snapshots consecutivos
 * según el progreso t [0,1]. El resto del estado (torres, elixir, status,
 * ganador, timer) sale del snapshot posterior tal cual — solo el
 * movimiento salta a la vista a ~1fps, lo demás no lo necesita. Unidades
 * nuevas en b (sin pareja en a, recién desplegadas) aparecen en su posición
 * de b sin interpolar; unidades que ya no están en b (murieron) simplemente
 * dejan de dibujarse, igual que en vivo.
 */
export function interpolateSnapshot(a, b, t) {
  if (!a) return null;
  if (!b || a === b) return a.state;

  const unitsAById = new Map((a.state.units ?? []).map((u) => [u.instanceId, u]));
  const units = (b.state.units ?? []).map((unitB) => {
    const unitA = unitsAById.get(unitB.instanceId);
    if (!unitA) return unitB;
    return {
      ...unitB,
      x: unitA.x + (unitB.x - unitA.x) * t,
      y: unitA.y + (unitB.y - unitA.y) * t,
    };
  });

  return { ...b.state, units };
}

/** Snapshot interpolado a mostrar en el instante `seconds` de la reproducción. */
export function sampleSnapshot(snapshots, seconds) {
  const [a, b] = findBracket(snapshots, seconds);
  if (!a) return null;
  if (a === b) return a.state;

  const tA = tickToSeconds(a.tick);
  const tB = tickToSeconds(b.tick);
  const t = tB > tA ? Math.max(0, Math.min(1, (seconds - tA) / (tB - tA))) : 0;
  return interpolateSnapshot(a, b, t);
}

/** Duración total (segundos de juego) cubierta por los snapshots de la replay. */
export function replayDuration(snapshots, fallbackSeconds) {
  if (!snapshots || snapshots.length === 0) return fallbackSeconds ?? 0;
  return tickToSeconds(snapshots[snapshots.length - 1].tick);
}
