export const TILE = 20; // píxeles por tile
export const BOARD_WIDTH = 18; // tiles
export const BOARD_HEIGHT = 32; // tiles

export const CANVAS_WIDTH = BOARD_WIDTH * TILE; // 360
export const CANVAS_HEIGHT = BOARD_HEIGHT * TILE; // 640

export const RIVER_ROWS = [15, 16];
export const BRIDGE_COLUMNS = [3, 14];

/**
 * El jugador local siempre se ve abajo. El canvas crece hacia abajo y el
 * tablero está "al revés", así que si soy TEAM_B el tablero se rota 180°.
 */
export function toCanvas(gameX, gameY, myTeam) {
  if (myTeam === 'TEAM_A') {
    return { x: gameX * TILE, y: (BOARD_HEIGHT - gameY) * TILE };
  }
  return { x: (BOARD_WIDTH - gameX) * TILE, y: gameY * TILE };
}

/** Inversa de toCanvas: canvasToGame(toCanvas(p, team), team) === p. */
export function canvasToGame(canvasX, canvasY, myTeam) {
  if (myTeam === 'TEAM_A') {
    return { x: canvasX / TILE, y: BOARD_HEIGHT - canvasY / TILE };
  }
  return { x: BOARD_WIDTH - canvasX / TILE, y: canvasY / TILE };
}
