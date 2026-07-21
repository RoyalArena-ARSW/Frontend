import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '../../components/AuthCard/AuthCard';
import { FormField } from '../../components/FormField/FormField';
import { Button } from '../../components/Button/Button';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { profileApi } from '../../api/profileApi';
import './RegisterPage.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ username, email, password, confirmPassword }) {
  const errors = {};
  if (!username.trim()) errors.username = 'Ingresa un usuario.';
  if (!email.trim()) {
    errors.email = 'Ingresa un email.';
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = 'El email no es válido.';
  }
  if (!password) {
    errors.password = 'Ingresa una contraseña.';
  } else if (password.length < 6) {
    errors.password = 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (confirmPassword !== password) {
    errors.confirmPassword = 'Las contraseñas no coinciden.';
  }
  return errors;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [profileFailed, setProfileFailed] = useState(false);
  const [createdUserId, setCreatedUserId] = useState(null);
  const [loading, setLoading] = useState(false);

  async function attemptCreateProfile(userId, displayName) {
    setLoading(true);
    try {
      await profileApi.createProfile({ userId, displayName });
      navigate('/menu', { replace: true });
    } catch (err) {
      setProfileFailed(true);
      showToast({ variant: 'error', message: err.message || 'No se pudo crear tu perfil de jugador.' });
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const errors = validate({ username, email, password, confirmPassword });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    let data;
    try {
      data = await register(username.trim(), email.trim(), password);
    } catch (err) {
      if (err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      } else {
        showToast({ variant: 'error', message: err.message || 'No se pudo completar el registro.' });
      }
      setLoading(false);
      return;
    }

    // La cuenta ya existe y la sesión quedó guardada: de aquí en más,
    // un error de perfil no debe hacer perder el registro.
    setCreatedUserId(data.user.id);
    await attemptCreateProfile(data.user.id, username.trim());
  }

  return (
    <AuthCard
      title="Royal Arena"
      subtitle="Crea tu cuenta y arma tu mazo"
      footer={
        <>
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </>
      }
    >
      {createdUserId && profileFailed ? (
        <div className="register-profile-warning">
          <p className="register-profile-warning__text">
            Tu cuenta se creó, pero todavía no pudimos crear tu perfil de jugador.
          </p>
          <Button
            type="button"
            loading={loading}
            onClick={() => attemptCreateProfile(createdUserId, username.trim())}
          >
            Reintentar
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/menu')}>
            Ir al menú de todas formas
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <FormField
            label="Usuario"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={fieldErrors.username}
            placeholder="tu_usuario"
          />
          <FormField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            placeholder="tucorreo@ejemplo.com"
          />
          <FormField
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            placeholder="••••••••"
          />
          <FormField
            label="Confirmar contraseña"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={fieldErrors.confirmPassword}
            placeholder="••••••••"
          />
          <Button type="submit" loading={loading}>
            Crear cuenta
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
