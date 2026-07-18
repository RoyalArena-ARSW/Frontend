import './FormError.css';

export function FormError({ message }) {
  if (!message) return null;

  return (
    <div className="form-error" role="alert">
      {message}
    </div>
  );
}
