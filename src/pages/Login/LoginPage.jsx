import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthCard } from '../../components/AuthCard/AuthCard';
import { FormField } from '../../components/FormField/FormField';
import { Button } from '../../components/Button/Button';
import { FormError } from '../../components/FormError/FormError';
import { useAuth } from '../../hooks/useAuth';

function validate({ identifier, password }) {
  const errors = {};
  if (!identifier.trim()) errors.identifier = 'Ingresa tu email o usuario.';
  if (!password) errors.password = 'Ingresa tu contraseña.';
  return errors;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectTo = location.state?.from?.pathname ?? '/menu';

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    const errors = validate({ identifier, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await login(identifier.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setFormError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Royal Arena"
      subtitle="Inicia sesión para entrar a la arena"
      footer={
        <>
          ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
        </>
      }
    >
      <FormError message={formError} />
      <form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Email o usuario"
          name="identifier"
          type="text"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          error={fieldErrors.identifier}
          placeholder="tucorreo@ejemplo.com"
        />
        <FormField
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          placeholder="••••••••"
        />
        <Button type="submit" loading={loading}>
          Entrar
        </Button>
      </form>
    </AuthCard>
  );
}
