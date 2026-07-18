import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

const GAME_ENGINE_URL = import.meta.env.VITE_WS_URL;
const WS_ENDPOINT = `${GAME_ENGINE_URL}/ws-game`;

export const WebSocketContext = createContext(null);

/**
 * Conexión STOMP/SockJS ÚNICA para toda la app: vive por encima del router
 * para sobrevivir a los cambios de pantalla (matchmaking -> battle). Si cada
 * pantalla abriera su propia conexión, tendríamos varias suscripciones y
 * mensajes duplicados.
 */
export function WebSocketProvider({ children }) {
  const clientRef = useRef(null);
  const subscriptionsRef = useRef(new Map());
  const nextSubIdRef = useRef(0);
  const pendingConnectResolversRef = useRef([]);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  // Tras cada (re)conexión hay que reabrir las suscripciones activas: el
  // broker no las recuerda de una sesión STOMP a la siguiente.
  const resubscribeAll = useCallback(() => {
    const client = clientRef.current;
    if (!client || !client.connected) return;
    for (const entry of subscriptionsRef.current.values()) {
      entry.stompSub = client.subscribe(entry.topic, (message) => {
        let payload = message.body;
        try {
          payload = JSON.parse(message.body);
        } catch {
          // el body no era JSON, se entrega tal cual
        }
        entry.callback(payload, message);
      });
    }
  }, []);

  const connect = useCallback(() => {
    const existing = clientRef.current;
    if (existing) {
      if (existing.connected) return Promise.resolve();
      return new Promise((resolve) => pendingConnectResolversRef.current.push(resolve));
    }

    setConnecting(true);
    setError('');

    return new Promise((resolve, reject) => {
      const client = new Client({
        webSocketFactory: () => new SockJS(WS_ENDPOINT),
        reconnectDelay: 3000,
        onConnect: () => {
          setConnected(true);
          setConnecting(false);
          resubscribeAll();
          resolve();
          const resolvers = pendingConnectResolversRef.current;
          pendingConnectResolversRef.current = [];
          resolvers.forEach((r) => r());
        },
        onWebSocketClose: () => {
          setConnected(false);
        },
        onStompError: (frame) => {
          const message = frame.headers?.message || 'Error de conexión con el servidor de juego.';
          setError(message);
          reject(new Error(message));
        },
      });

      clientRef.current = client;
      client.activate();
    });
  }, [resubscribeAll]);

  const disconnect = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;
    client.deactivate();
    clientRef.current = null;
    subscriptionsRef.current.clear();
    pendingConnectResolversRef.current = [];
    setConnected(false);
    setConnecting(false);
  }, []);

  const subscribe = useCallback((topic, callback) => {
    const id = nextSubIdRef.current++;
    const entry = { topic, callback, stompSub: null };
    subscriptionsRef.current.set(id, entry);

    const client = clientRef.current;
    if (client && client.connected) {
      entry.stompSub = client.subscribe(topic, (message) => {
        let payload = message.body;
        try {
          payload = JSON.parse(message.body);
        } catch {
          // el body no era JSON, se entrega tal cual
        }
        callback(payload, message);
      });
    }

    return {
      unsubscribe: () => {
        entry.stompSub?.unsubscribe();
        subscriptionsRef.current.delete(id);
      },
    };
  }, []);

  const send = useCallback((destination, body) => {
    const client = clientRef.current;
    if (!client || !client.connected) {
      throw new Error('No hay conexión con el servidor de juego.');
    }
    client.publish({ destination, body: JSON.stringify(body) });
  }, []);

  // Solo se desconecta cuando el provider muere con la app, no en cada
  // navegación (para eso está montado por encima del router).
  useEffect(() => disconnect, [disconnect]);

  const value = { connected, connecting, error, connect, disconnect, subscribe, send };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}
