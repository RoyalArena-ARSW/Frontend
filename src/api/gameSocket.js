import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import { getToken } from './client';

const WS_URL = import.meta.env.VITE_WS_URL;
const WS_ENDPOINT = `${WS_URL}/ws-game`;

/**
 * Crea (sin conectar) un cliente STOMP sobre SockJS para el Game Engine.
 * El caller decide cuándo activate()/deactivate() y qué se suscribe.
 */
export function createGameSocket({ onConnect, onDisconnect, onStompError } = {}) {
  const client = new Client({
    webSocketFactory: () => new SockJS(WS_ENDPOINT),
    connectHeaders: {
      Authorization: `Bearer ${getToken() ?? ''}`,
    },
    reconnectDelay: 5000,
    onConnect,
    onDisconnect,
    onStompError,
  });

  return client;
}
