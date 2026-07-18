import './PagePlaceholder.css';

export function PagePlaceholder({ name }) {
  return (
    <div className="page-placeholder">
      <h1 className="page-placeholder__title">{name}</h1>
    </div>
  );
}
