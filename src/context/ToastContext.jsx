import { createContext, useCallback, useRef, useState } from 'react';
import { ToastViewport } from '../components/Toast/ToastViewport';

export const ToastContext = createContext(null);

let nextToastId = 0;

/**
 * Notificaciones globales (toast/banner). Vive por encima del router para
 * poder disparar un aviso justo antes de navegar (p. ej. matchmaking te
 * manda de vuelta al menú) y que siga visible en la pantalla siguiente.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timeoutsRef = useRef(new Map());

  const dismissToast = useCallback((id) => {
    const pending = timeoutsRef.current.get(id);
    if (pending) clearTimeout(pending);

    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, closing: true } : t)));

    const closeTimeout = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timeoutsRef.current.delete(id);
    }, 220);
    timeoutsRef.current.set(id, closeTimeout);
  }, []);

  const showToast = useCallback(
    ({ variant = 'info', message, action, duration = 4000 }) => {
      const id = nextToastId++;
      setToasts((prev) => [...prev, { id, variant, message, action, closing: false }]);

      if (duration > 0) {
        const timeout = setTimeout(() => dismissToast(id), duration);
        timeoutsRef.current.set(id, timeout);
      }

      return id;
    },
    [dismissToast],
  );

  const value = { showToast, dismissToast };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
