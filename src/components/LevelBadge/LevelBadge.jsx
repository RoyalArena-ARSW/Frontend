import './LevelBadge.css';

export function LevelBadge({ level, size = 'md' }) {
  return (
    <div className={`level-badge level-badge--${size}`} title={`Nivel ${level}`}>
      <span className="level-badge__value">{level}</span>
    </div>
  );
}
