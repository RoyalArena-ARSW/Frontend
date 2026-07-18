import './FormField.css';

export function FormField({ label, name, error, ...inputProps }) {
  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={`form-field__input${error ? ' form-field__input--error' : ''}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={`${name}-error`} className="form-field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
