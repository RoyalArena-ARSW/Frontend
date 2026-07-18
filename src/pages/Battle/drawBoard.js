import { BRIDGE_COLUMNS, CANVAS_HEIGHT, CANVAS_WIDTH, RIVER_ROWS, toCanvas } from '../../utils/coordinates';

const TOWER_SIZE = { KING: 24, PRINCESS_LEFT: 18, PRINCESS_RIGHT: 18 };
const UNIT_RADIUS = 6;

const COLOR_MINE = '#3b82f6';
const COLOR_ENEMY = '#ef4444';
const COLOR_RIVER = 'rgba(56, 130, 200, 0.45)';
const COLOR_BRIDGE = '#8a6a45';
const HEALTH_BG = '#7a1f1f';
const HEALTH_FG = '#3fbf5f';

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

function drawTowers(ctx, towers, myTeam) {
  for (const tower of towers) {
    if (tower.destroyed) continue;

    const { x, y } = toCanvas(tower.x, tower.y, myTeam);
    const size = TOWER_SIZE[tower.type] ?? 18;
    const color = tower.team === myTeam ? COLOR_MINE : COLOR_ENEMY;

    ctx.fillStyle = color;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);

    const ratio = tower.maxHealth > 0 ? tower.currentHealth / tower.maxHealth : 0;
    drawHealthBar(ctx, x, y - size / 2 - 8, size + 6, 4, ratio);
  }
}

function drawUnits(ctx, units, myTeam) {
  for (const unit of units) {
    const { x, y } = toCanvas(unit.x, unit.y, myTeam);
    const color = unit.team === myTeam ? COLOR_MINE : COLOR_ENEMY;

    ctx.beginPath();
    ctx.arc(x, y, UNIT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    const ratio = unit.maxHealth > 0 ? unit.currentHealth / unit.maxHealth : 0;
    drawHealthBar(ctx, x, y - UNIT_RADIUS - 7, UNIT_RADIUS * 3, 3, ratio);
  }
}

/** Dibuja un frame completo del tablero. snapshot puede ser null (aún sin datos). */
export function drawBoard(ctx, snapshot, myTeam, bgImage) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
    ctx.drawImage(bgImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = '#1c2650';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  drawRiverAndBridges(ctx, myTeam);

  if (!snapshot) return;

  drawTowers(ctx, snapshot.towers ?? [], myTeam);
  drawUnits(ctx, snapshot.units ?? [], myTeam);
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Actualiza el HUD (timer, elixir, overlay de fin de partida) leyendo directamente el DOM vía refs, sin pasar por React state. */
export function updateHud(snapshot, myTeam, refs, myUserId) {
  if (!snapshot) return;

  if (refs.timerRef.current) {
    refs.timerRef.current.textContent = formatTime(snapshot.remainingSeconds);
  }

  const me = snapshot.players?.find((p) => p.userId === myUserId);
  const opponent = snapshot.players?.find((p) => p.userId !== myUserId);

  if (refs.myElixirRef.current) {
    refs.myElixirRef.current.textContent = `Elixir: ${(me?.elixir ?? 0).toFixed(1)}`;
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
