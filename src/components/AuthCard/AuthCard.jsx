import './AuthCard.css';

export function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-card__title">{title}</h1>
        {subtitle ? <p className="auth-card__subtitle">{subtitle}</p> : null}
        {children}
        {footer ? <div className="auth-card__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
