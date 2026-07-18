const BASE_URL = import.meta.env.VITE_API_URL;

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Error de API enriquecido: conserva el status HTTP y, si el backend los
 * mandó (400 de validación), el mapa fieldErrors { campo: mensaje }.
 */
export class ApiError extends Error {
  constructor(message, { status, fieldErrors, body } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors ?? null;
    this.body = body ?? null;
  }
}

async function parseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Wrapper de fetch: agrega base URL, header Authorization si hay token,
 * normaliza errores del backend y fuerza logout ante un 401.
 */
async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    clearSession();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiError('Sesión expirada, por favor inicia sesión de nuevo.', { status: 401 });
  }

  const data = await parseBody(response);

  if (!response.ok) {
    const message = data?.message || data?.error || `Error ${response.status}`;
    throw new ApiError(message, { status: response.status, fieldErrors: data?.fieldErrors, body: data });
  }

  return data;
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};
