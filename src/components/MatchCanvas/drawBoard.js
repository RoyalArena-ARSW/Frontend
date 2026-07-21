import { BRIDGE_COLUMNS, CANVAS_HEIGHT, CANVAS_WIDTH, RIVER_ROWS, TILE, toCanvas } from '../../utils/coordinates';
import { isValidDeployCanvasPos } from '../../utils/deployment';
import { ensureImage, normalizeKey } from '../../utils/spriteLoader';

const UNIT_RADIUS = 8;

const COLOR_MINE = '#3b82f6';
const COLOR_ENEMY = '#ef4444';
const COLOR_RIVER = 'rgba(56, 130, 200, 0.45)';
const COLOR_BRIDGE = 'rgba(138, 106, 69, 0.55)';
const HEALTH_BG = '#7a1f1f';
const HEALTH_FG = '#3fbf5f';

const ZONE_VALID = 'rgba(63, 191, 95, 0.22)';
const ZONE_INVALID = 'rgba(239, 68, 68, 0.16)';
const MARKER_VALID = 'rgba(63, 191, 95, 0.9)';
const MARKER_INVALID = 'rgba(239, 68, 68, 0.9)';
const MARKER_RADIUS = 10;

// Tamaño BASE de dibujo en tiles (NO el tamaño nativo del PNG), antes de
// aplicar el multiplicador por carta de TROOP_SIZE_SCALE.
const UNIT_BASE_SIZE = {
  troop: TILE * 1.8,
  building: TILE * 2.2,
};

// Tropas grandes/pequeñas se ven más/menos grandes que el resto (Knight y
// las no listadas quedan en tamaño medio, escala 1).
const TROOP_SCALE_LARGE = 1.35;
const TROOP_SCALE_SMALL = 0.7;
const TROOP_SIZE_SCALE = new Map(
  [
    ['Giant', TROOP_SCALE_LARGE],
    ['Prince', TROOP_SCALE_LARGE],
    ['Mini P.E.K.K.A', TROOP_SCALE_LARGE],
    ['Valkyrie', TROOP_SCALE_LARGE],
    ['Musketeer', TROOP_SCALE_LARGE],
    ['Baby Dragon', TROOP_SCALE_LARGE],
    ['Skeleton', TROOP_SCALE_SMALL],
    ['Skeletons', TROOP_SCALE_SMALL],
    ['Goblin', TROOP_SCALE_SMALL],
    ['Goblins', TROOP_SCALE_SMALL],
    ['Spear Goblins', TROOP_SCALE_SMALL],
    ['SpearGoblins', TROOP_SCALE_SMALL],
    ['Bomber', TROOP_SCALE_SMALL],
    ['Archer', TROOP_SCALE_SMALL],
    ['Archers', TROOP_SCALE_SMALL],
    ['Minion', TROOP_SCALE_SMALL],
    ['Minions', TROOP_SCALE_SMALL],
  ].map(([name, scale]) => [normalizeKey(name), scale]),
);

function troopScaleFor(cardName) {
  return TROOP_SIZE_SCALE.get(normalizeKey(cardName)) ?? 1;
}

// normalizeKey ya hace trim + lowercase (y de paso quita espacios/puntuación
// internos), así que el emparejamiento cardName <-> claves del manifiesto es
// tolerante a mayúsculas/espacios en ambos lados. Este set evita spamear la
// consola: cada carta sin sprite se reporta una sola vez.
const warnedMissingSprites = new Set();
function warnMissingSprite(cardName, spriteIndex) {
  const key = normalizeKey(cardName);
  if (warnedMissingSprites.has(key)) return;
  warnedMissingSprites.add(key);
  console.warn(
    `[Battle] Sin sprite para la carta "${cardName}" (clave normalizada "${key}"). Cae al círculo de color. Claves disponibles en el manifiesto:`,
    Array.from(spriteIndex.keys()),
  );
}

// Tamaño de las torres en tiles, pensado para calzar sobre las plataformas
// de piedra ya dibujadas en el fondo de la arena (jungle_arena.png). El rey
// es más grande que las princesas. Usado tanto por el sprite real como por
// el rectángulo geométrico de respaldo/debug, para que ambos sean comparables.
const TOWER_SPRITE_SIZE = {
  KING: { width: TILE * 4, height: TILE * 4 },
  PRINCESS_LEFT: { width: TILE * 3, height: TILE * 3 },
  PRINCESS_RIGHT: { width: TILE * 3, height: TILE * 3 },
};
const SPELL_EFFECT_SIZE = { width: TILE * 2.4, height: TILE * 2.4 };
export const SPELL_EFFECT_DURATION_MS = 600;

// El snapshot no dice explícitamente si una torre está disparando: se
// aproxima mirando si tiene algún enemigo suyo (no del jugador local, del
// dueño de la torre) dentro de este radio, en tiles del tablero de juego.
const TOWER_ATTACK_RANGE_TILES = 7.5;

function isTowerAttacking(tower, units) {
  if (!units || units.length === 0) return false;
  for (const unit of units) {
    if (unit.team === tower.team || unit.state === 'DEAD') continue;
    const dx = unit.x - tower.x;
    const dy = unit.y - tower.y;
    if (dx * dx + dy * dy <= TOWER_ATTACK_RANGE_TILES * TOWER_ATTACK_RANGE_TILES) return true;
  }
  return false;
}

function rowBoundaryY(row, myTeam) {
  return toCanvas(0, row, myTeam).y;
}

function colBoundaryX(col, myTeam) {
  return toCanvas(col, 0, myTeam).x;
}

function drawHealthBar(ctx, centerX, topY, width, height, ratio) {
  const x = centerX - width / 2;
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = HEALTH_BG;
  ctx.fillRect(x, topY, width, height);
  ctx.fillStyle = HEALTH_FG;
  ctx.fillRect(x, topY, width * clampedRatio, height);
}

function drawRiverAndBridges(ctx, myTeam) {
  const riverYs = [rowBoundaryY(RIVER_ROWS[0], myTeam), rowBoundaryY(RIVER_ROWS[1] + 1, myTeam)];
  const riverTop = Math.min(...riverYs);
  const riverBottom = Math.max(...riverYs);

  ctx.fillStyle = COLOR_RIVER;
  ctx.fillRect(0, riverTop, CANVAS_WIDTH, riverBottom - riverTop);

  ctx.fillStyle = COLOR_BRIDGE;
  for (const col of BRIDGE_COLUMNS) {
    const xs = [colBoundaryX(col, myTeam), colBoundaryX(col + 1, myTeam)];
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    ctx.fillRect(left, riverTop, right - left, riverBottom - riverTop);
  }

  return { riverTop, riverBottom };
}

/**
 * Sprite real de una torre: intact.png / destroyed.png (escombros) según
 * tower.destroyed, o un frame de attack/ animado encima de intact si hay un
 * enemigo suyo cerca (ver isTowerAttacking). null si no hay sprite cargado
 * todavía (cae al respaldo geométrico).
 */
function drawTowerSprite(ctx, tower, canvasPos, myTeam, units, spriteCtx) {
  const variant = tower.team === myTeam ? 'allied' : 'enemy';
  const descriptor = spriteCtx.towerIndex?.[tower.type]?.[variant];
  if (!descriptor) return false;

  let url;
  if (tower.destroyed) {
    url = descriptor.destroyed;
  } else if (descriptor.attack.length > 0 && isTowerAttacking(tower, units)) {
    const towerKey = `tower-${tower.type}-${tower.team}`;
    const frameIndex = spriteCtx.towerController.getFrameIndex(towerKey, 'attack', descriptor.attack.length);
    url = descriptor.attack[frameIndex];
  } else {
    url = descriptor.intact;
  }
  if (!url) return false;

  const img = ensureImage(url);
  if (!img) return false;

  const size = TOWER_SPRITE_SIZE[tower.type] ?? TOWER_SPRITE_SIZE.PRINCESS_LEFT;
  const { x, y } = canvasPos;
  // Las torres son estructuras fijas: se centran en su coordenada de juego
  // (no se anclan a los pies como las unidades), para caer sobre su
  // plataforma en el fondo en vez de quedar desplazadas hacia arriba.
  ctx.drawImage(img, x - size.width / 2, y - size.height / 2, size.width, size.height);

  if (!tower.destroyed) {
    const ratio = tower.maxHealth > 0 ? tower.currentHealth / tower.maxHealth : 0;
    drawHealthBar(ctx, x, y - size.height / 2 - 8, size.width * 0.7, 4, ratio);
  }
  return true;
}

const COLOR_DESTROYED = 'rgba(90, 90, 100, 0.85)';

function drawTowerShape(ctx, tower, canvasPos, myTeam) {
  const { x, y } = canvasPos;
  // Mismo tamaño que el sprite (TOWER_SPRITE_SIZE), centrado igual, para que
  // el rectángulo de debug (tecla D) sea directamente comparable al sprite
  // real sobre la plataforma de la arena.
  const size = TOWER_SPRITE_SIZE[tower.type] ?? TOWER_SPRITE_SIZE.PRINCESS_LEFT;

  if (tower.destroyed) {
    ctx.fillStyle = COLOR_DESTROYED;
    ctx.fillRect(x - size.width / 2, y - size.height / 2, size.width, size.height);
    return; // escombros: sin barra de vida
  }

  const color = tower.team === myTeam ? COLOR_MINE : COLOR_ENEMY;
  ctx.fillStyle = color;
  ctx.fillRect(x - size.width / 2, y - size.height / 2, size.width, size.height);

  const ratio = tower.maxHealth > 0 ? tower.currentHealth / tower.maxHealth : 0;
  drawHealthBar(ctx, x, y - size.height / 2 - 8, size.width + 6, 4, ratio);
}

function drawTowers(ctx, towers, units, myTeam, spriteCtx) {
  for (const tower of towers) {
    // Las destruidas se siguen dibujando (escombros), no desaparecen.
    const canvasPos = toCanvas(tower.x, tower.y, myTeam);

    if (spriteCtx?.useSprites && drawTowerSprite(ctx, tower, canvasPos, myTeam, units, spriteCtx)) continue;
    drawTowerShape(ctx, tower, canvasPos, myTeam);
  }
}

/** Frame animado (walk/attack, según state) para una tropa o edificio; null si no aplica o aún no cargó. */
function drawUnitSprite(ctx, unit, canvasPos, myTeam, spriteCtx) {
  const { spriteIndex, controller } = spriteCtx;
  const descriptor = spriteIndex.get(normalizeKey(unit.cardName));
  if (!descriptor || (descriptor.type !== 'troop' && descriptor.type !== 'building')) {
    warnMissingSprite(unit.cardName, spriteIndex);
    return false;
  }

  const variant = unit.team === myTeam ? 'allied' : 'enemy';
  const isDead = unit.state === 'DEAD';
  // Sin sprites de idle ni de muerte a propósito: idle = primer frame de walk.
  const action = unit.state === 'ATTACKING' ? 'attack' : 'walk';
  const framesNode = descriptor[action] ?? descriptor.walk ?? descriptor.attack;
  const frames = framesNode?.[variant];
  if (!frames || frames.length === 0) {
    warnMissingSprite(unit.cardName, spriteIndex);
    return false;
  }

  const frameIndex = controller.getFrameIndex(unit.instanceId, isDead ? 'walk' : action, frames.length);
  const img = ensureImage(frames[frameIndex]);
  if (!img) return false;

  const opacity = controller.getOpacity(unit.instanceId, isDead);
  if (opacity <= 0) return true; // ya invisible: se maneja como dibujado (no cae al fallback)

  const scale = descriptor.type === 'troop' ? troopScaleFor(unit.cardName) : 1;
  const base = UNIT_BASE_SIZE[descriptor.type];
  const size = { width: base * scale, height: base * scale };
  const { x, y } = canvasPos;

  ctx.save();
  ctx.globalAlpha = opacity;
  // Ancla a los pies (no al centro): si no, las unidades parecen flotar.
  ctx.drawImage(img, x - size.width / 2, y - size.height, size.width, size.height);
  ctx.restore();

  const ratio = unit.maxHealth > 0 ? unit.currentHealth / unit.maxHealth : 0;
  drawHealthBar(ctx, x, y - size.height - 8, size.width * 0.8, 4, ratio);
  return true;
}

function drawUnitShape(ctx, unit, canvasPos, myTeam) {
  const { x, y } = canvasPos;
  const color = unit.team === myTeam ? COLOR_MINE : COLOR_ENEMY;
  const radius = UNIT_RADIUS * troopScaleFor(unit.cardName);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  const ratio = unit.maxHealth > 0 ? unit.currentHealth / unit.maxHealth : 0;
  drawHealthBar(ctx, x, y - radius - 7, radius * 3, 3, ratio);
}

function drawUnits(ctx, units, myTeam, spriteCtx) {
  // Painter's algorithm: las unidades "de atrás" (menor y de canvas) primero,
  // para que las de adelante las tapen bien.
  const positioned = units.map((unit) => ({ unit, pos: toCanvas(unit.x, unit.y, myTeam) }));
  positioned.sort((a, b) => a.pos.y - b.pos.y);

  for (const { unit, pos } of positioned) {
    if (spriteCtx?.useSprites && drawUnitSprite(ctx, unit, pos, myTeam, spriteCtx)) continue;
    drawUnitShape(ctx, unit, pos, myTeam);
  }
}

/**
 * Dibuja un frame completo del tablero. snapshot puede ser null (aún sin
 * datos). bg = { image, crop } — crop (opcional) es el rectángulo del PNG
 * fuente sin el margen transparente (ver computeOpaqueBounds); sin crop se
 * estira la imagen completa. spriteCtx = { spriteIndex, towerIndex,
 * controller, useSprites } es opcional: sin él (o con useSprites=false) se
 * usan las formas geométricas.
 *
 * Función "pura" respecto a la fuente del snapshot: no le importa si viene
 * del WebSocket (batalla/espectador) o de una reproducción interpolada por
 * temporizador (replay) — ver MatchCanvas.jsx.
 */
let arenaDrawLogged = false;

export function drawBoard(ctx, snapshot, myTeam, bg, spriteCtx) {
  // Dimensiones REALES del elemento <canvas> (no una constante que podría
  // desincronizarse), para que la arena cubra el canvas de borde a borde.
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const bgImage = bg?.image;
  if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
    if (bg.crop) {
      // Recorta el padding transparente del PNG y estira SOLO el contenido
      // real al canvas completo: llenar > mantener la proporción original.
      ctx.drawImage(bgImage, bg.crop.x, bg.crop.y, bg.crop.width, bg.crop.height, 0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.drawImage(bgImage, 0, 0, canvasWidth, canvasHeight);
    }
    if (!arenaDrawLogged) {
      arenaDrawLogged = true;
      console.log('[Battle] Arena de fondo dibujada en el canvas', bg.crop ? '(recortada al contenido opaco).' : '.');
    }
  } else {
    // Respaldo mientras la arena carga (o si no cargó): el azul de siempre.
    ctx.fillStyle = '#1c2650';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // El río y los puentes van semitransparentes encima, para que se note la arena debajo.
  drawRiverAndBridges(ctx, myTeam);

  if (!snapshot) return;

  drawTowers(ctx, snapshot.towers ?? [], snapshot.units ?? [], myTeam, spriteCtx);
  drawUnits(ctx, snapshot.units ?? [], myTeam, spriteCtx);
}

/**
 * Hechizos jugados por el jugador local: como el motor no los reporta en el
 * snapshot (limitación conocida del backend), se animan del lado del
 * cliente durante SPELL_EFFECT_DURATION_MS a partir del momento en que se
 * jugaron. Los hechizos del rival no se ven por la misma razón. No aplica en
 * espectador/replay (nadie juega cartas ahí).
 */
export function drawSpellEffects(ctx, spellEffects, myTeam, spriteIndex, now) {
  if (!spriteIndex) return;

  for (const effect of spellEffects) {
    const descriptor = spriteIndex.get(normalizeKey(effect.cardName));
    const frames = descriptor?.effect;
    if (!frames || frames.length === 0) continue;

    const progress = Math.min(1, (now - effect.startedAt) / SPELL_EFFECT_DURATION_MS);
    const frameIndex = Math.min(frames.length - 1, Math.floor(progress * frames.length));
    const img = ensureImage(frames[frameIndex]);
    if (!img) continue;

    const { x, y } = toCanvas(effect.x, effect.y, myTeam);
    ctx.save();
    ctx.globalAlpha = 1 - progress * 0.15;
    ctx.drawImage(
      img,
      x - SPELL_EFFECT_SIZE.width / 2,
      y - SPELL_EFFECT_SIZE.height / 2,
      SPELL_EFFECT_SIZE.width,
      SPELL_EFFECT_SIZE.height,
    );
    ctx.restore();
  }
}

/**
 * Sombrea la zona válida/inválida para desplegar la carta activa (seleccionada
 * o arrastrada) y marca la posición del cursor. deploymentType null significa
 * "sin carta activa" -> no dibuja nada. Solo lo usa la batalla en vivo.
 */
export function drawDeployOverlay(ctx, deploymentType, pointerCanvasPos) {
  if (!deploymentType) return;

  if (deploymentType === 'OWN_SIDE') {
    ctx.fillStyle = ZONE_INVALID;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT / 2);
    ctx.fillStyle = ZONE_VALID;
    ctx.fillRect(0, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT / 2);
  } else {
    ctx.fillStyle = ZONE_VALID;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  if (!pointerCanvasPos) return;

  const valid = isValidDeployCanvasPos(pointerCanvasPos.x, pointerCanvasPos.y, deploymentType);
  ctx.beginPath();
  ctx.arc(pointerCanvasPos.x, pointerCanvasPos.y, MARKER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = valid ? MARKER_VALID : MARKER_INVALID;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.stroke();
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Coronas de un equipo = torres DEL RIVAL destruidas (princesas + rey). */
export function countCrowns(towers, team) {
  return (towers ?? []).filter((t) => t.team !== team && t.destroyed).length;
}

/** Actualiza el HUD (timer, elixir, overlay de fin de partida) leyendo directamente el DOM vía refs, sin pasar por React state. Usado por la batalla en vivo (noción de "mi equipo"/"rival"). */
export function updateHud(snapshot, myTeam, refs, myUserId) {
  if (!snapshot) return;

  if (refs.timerRef.current) {
    refs.timerRef.current.textContent = formatTime(snapshot.remainingSeconds);
  }

  const me = snapshot.players?.find((p) => p.userId === myUserId);
  const opponent = snapshot.players?.find((p) => p.userId !== myUserId);

  if (refs.myElixirTargetRef) {
    refs.myElixirTargetRef.current = me?.elixir ?? 0;
  }
  if (refs.opponentElixirRef.current) {
    refs.opponentElixirRef.current.textContent = `Rival: ${(opponent?.elixir ?? 0).toFixed(1)}`;
  }

  if (refs.overlayRef.current) {
    if (snapshot.status === 'FINISHED') {
      refs.overlayRef.current.style.display = 'flex';
      if (refs.overlayTextRef.current) {
        let resultText = 'Empate';
        if (snapshot.winner === myTeam) resultText = '¡Victoria!';
        else if (snapshot.winner) resultText = 'Derrota';
        refs.overlayTextRef.current.textContent = resultText;
      }
    } else {
      refs.overlayRef.current.style.display = 'none';
    }
  }
}

/**
 * Igual que updateHud, pero sin noción de "jugador local": TEAM_A/TEAM_B en
 * vez de mi/rival, y con marcador de coronas (derivado de las torres
 * destruidas, el motor no lo manda explícito). Usado por espectador Y
 * replay — ambos son "de solo lectura" y sin equipo propio.
 */
export function updateReadOnlyHud(snapshot, refs, names) {
  if (!snapshot) return;

  if (refs.timerRef.current) {
    refs.timerRef.current.textContent = formatTime(snapshot.remainingSeconds);
  }

  const teamA = snapshot.players?.find((p) => p.team === 'TEAM_A');
  const teamB = snapshot.players?.find((p) => p.team === 'TEAM_B');

  if (refs.elixirARef) refs.elixirARef.current = teamA?.elixir ?? 0;
  if (refs.elixirBRef) refs.elixirBRef.current = teamB?.elixir ?? 0;

  if (refs.crownsRef.current) {
    const towers = snapshot.towers ?? [];
    refs.crownsRef.current.textContent = `${countCrowns(towers, 'TEAM_A')} - ${countCrowns(towers, 'TEAM_B')}`;
  }

  if (refs.overlayRef.current) {
    if (snapshot.status === 'FINISHED') {
      refs.overlayRef.current.style.display = 'flex';
      if (refs.overlayTextRef.current) {
        let resultText = 'Empate';
        if (snapshot.winner === 'TEAM_A') resultText = `¡${names?.TEAM_A ?? 'Jugador A'} gana!`;
        else if (snapshot.winner === 'TEAM_B') resultText = `¡${names?.TEAM_B ?? 'Jugador B'} gana!`;
        refs.overlayTextRef.current.textContent = resultText;
      }
    } else {
      refs.overlayRef.current.style.display = 'none';
    }
  }
}
