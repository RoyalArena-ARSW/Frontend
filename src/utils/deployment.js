import { CANVAS_HEIGHT, CANVAS_WIDTH } from './coordinates';

/**
 * El jugador local siempre se dibuja abajo (ver toCanvas en coordinates.js),
 * así que su mitad válida para OWN_SIDE es siempre la mitad inferior del
 * canvas, sin importar el equipo real.
 */
export function isValidDeployCanvasPos(canvasX, canvasY, deploymentType) {
  if (canvasX < 0 || canvasX > CANVAS_WIDTH || canvasY < 0 || canvasY > CANVAS_HEIGHT) return false;
  if (deploymentType === 'OWN_SIDE') {
    return canvasY >= CANVAS_HEIGHT / 2;
  }
  return true;
}
