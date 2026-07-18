import './Button.css';

export function Button({ children, loading = false, variant = 'primary', disabled, ...rest }) {
  return (
    <button
      className={`btn btn--${variant}${loading ? ' btn--loading' : ''}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}
