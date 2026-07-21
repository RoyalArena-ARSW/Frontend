import './Toast.css';

const ICON = { error: '⛔', warning: '⚠️', info: 'ℹ️' };

export function Toast({ variant = 'info', message, action, closing, onClose }) {
  return (
    <div className={`toast toast--${variant}${closing ? ' toast--closing' : ''}`} role="alert">
      <span className="toast__icon" aria-hidden="true">
        {ICON[variant] ?? ICON.info}
      </span>
      <p className="toast__message">{message}</p>
      {action ? (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            action.onClick?.();
            onClose();
          }}
        >
          {action.label}
        </button>
      ) : null}
      <button type="button" className="toast__close" onClick={onClose} aria-label="Cerrar notificación">
        ×
      </button>
    </div>
  );
}
