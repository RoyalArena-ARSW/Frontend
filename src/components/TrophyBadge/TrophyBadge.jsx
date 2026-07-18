import './TrophyBadge.css';

export function TrophyBadge({ value = 0, size = 'md' }) {
  return (
    <span className={`trophy-badge trophy-badge--${size}`}>
      <svg className="trophy-badge__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6 3h12v2h2a1 1 0 0 1 1 1v1c0 2.76-1.94 5.06-4.5 5.7A6 6 0 0 1 13 17.9V20h3v2H8v-2h3v-2.1a6 6 0 0 1-3.5-5.2C4.94 12.06 3 9.76 3 7V6a1 1 0 0 1 1-1h2V3Zm0 4H5v0c0 1.5.9 2.77 2.2 3.36A9 9 0 0 1 6 9V7Zm12 0v2c0 .46-.05.9-.2 1.36A4 4 0 0 0 19 7h-1Z"
          fill="currentColor"
        />
      </svg>
      <span className="trophy-badge__value">{Number(value).toLocaleString('es')}</span>
    </span>
  );
}
