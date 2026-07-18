import './ProgressBar.css';

export function ProgressBar({ value, label }) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div className="progress-bar">
      {label ? <div className="progress-bar__label">{label}</div> : null}
      <div
        className="progress-bar__track"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-bar__fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
