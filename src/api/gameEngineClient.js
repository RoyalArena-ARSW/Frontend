// Cliente compartido para el Game Engine: matchmaking y partida van DIRECTO
// a este servicio, sin pasar por el Gateway (por eso no es apiClient).
const GAME_ENGINE_URL = import.meta.env.VITE_WS_URL;

async function parseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${GAME_ENGINE_URL}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await parseBody(response);

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Error ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

export const gameEngineClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
};
