import './Spinner.css';

export function Spinner({ size = 'md' }) {
  return <span className={`spinner spinner--${size}`} role="status" aria-label="Cargando" />;
}
