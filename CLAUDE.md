# Royal Arena — Frontend

Frontend de Royal Arena, un juego multijugador en tiempo real tipo Clash Royale.
Vite + React (JavaScript, sin TypeScript), react-router-dom, CSS plano.

## Arquitectura del backend

Microservicios Spring Boot detrás de un API Gateway. **Casi todo el tráfico
HTTP pasa por el Gateway**, con una excepción: el Game Engine (WebSocket +
matchmaking REST) se llama directo, sin pasar por el Gateway.

- Gateway: `http://localhost:8080` (`VITE_API_URL`)
- Game Engine (WebSocket y matchmaking REST, van directo, no por el Gateway):
  `http://localhost:8084` (`VITE_WS_URL` — el nombre es histórico, esta misma
  URL se usa como base tanto del WS como del REST directo del Game Engine)

## Autenticación

JWT. El token se manda en cada request autenticado como:

```
Authorization: Bearer <token>
```

El wrapper `src/api/client.js` lo inyecta automáticamente si hay un token en
`localStorage`. Si el backend responde 401, `client.js` limpia la sesión y
redirige a `/login`.

### POST /api/auth/register

```
Body:  { "username": "...", "email": "...", "password": "..." }

201:   {
         "token": "eyJ...",
         "tokenType": "Bearer",
         "expiresIn": 86400,
         "user": {
           "id": 5,
           "username": "...",
           "email": "...",
           "role": "PLAYER",
           "authProvider": "LOCAL",
           "active": true,
           "createdAt": "..."
         }
       }

409:   { "error": "Conflict", "message": "Email ya registrado: ..." }

400:   { "error": "Bad Request", "message": "Validation failed",
         "fieldErrors": { "password": "Password is required", ... } }
```

**IMPORTANTE**: Auth crea el usuario pero NO su perfil. Ver
[Flujo crítico: registro → perfil](#flujo-crítico-registro--perfil).

### POST /api/auth/login

```
Body:  { "identifier": "...", "password": "..." }   // identifier = email O username

200:   mismo formato que register (token, tokenType, expiresIn, user)

401:   { "error": "Unauthorized", "message": "Credenciales inválidas" }
```

### GET /api/auth/me

Requiere Bearer token. Devuelve el usuario autenticado (mismo shape que
`user` en register/login).

## Perfiles

### GET /api/profiles/me

Requiere Bearer token. Devuelve el perfil del usuario autenticado: trofeos,
nivel, winRate, etc.

### POST /api/profiles

Requiere Bearer token.

```
Body:  { "userId": <id numérico del usuario>, "displayName": "..." }
201:   el perfil creado
```

## Flujo crítico: registro → perfil

El microservicio de Auth **no crea el perfil del jugador**. Sin perfil, el
matchmaking y el leaderboard fallan para ese usuario. El flujo correcto tras
un registro exitoso es:

1. `POST /api/auth/register` → obtener `{ token, user }`.
2. Guardar el token (queda autenticado).
3. `POST /api/profiles` con `{ userId: user.id, displayName: username }`.
4. Si el paso 3 falla, **no se debe cerrar la sesión** — el usuario ya existe
   en Auth, solo le falta el perfil. Mostrar el error y permitir reintentar o
   continuar.

## Mazos

### GET /api/decks/my/active

Requiere Bearer token. Devuelve el mazo activo del usuario con sus 8 cartas.

## Cartas

### GET /api/cards

Público, sin autenticación. Catálogo completo de cartas del juego.

## Matchmaking

**Va directo a `http://localhost:8084` (Game Engine), NO por el Gateway.**
`src/api/matchmakingApi.js` usa su propio `fetch`, no `apiClient`.

### POST /api/matchmaking/join

```
Body:  { "userId": <id numérico> }
200:   { "result": "...", "queueSize": <n> }
```

`result` puede ser:

- `QUEUED` — quedó esperando oponente.
- `MATCHED` — se creó la partida ya mismo; la notificación llega por WebSocket.
- `ALREADY_QUEUED` — ya estaba en la cola.
- `NO_ACTIVE_DECK` — no tiene mazo activo (culpa del usuario → link a `/deck`).
- `DECK_SERVICE_UNAVAILABLE` — Deck-and-Cards no responde (culpa del sistema).

### POST /api/matchmaking/leave

```
Body:  { "userId": <id numérico> }
200:   { "removed": true, "queueSize": <n> }
```

Hay que llamarlo si el jugador cancela la búsqueda **o** si la pantalla de
matchmaking se desmonta mientras seguía en cola — si no, queda fantasma.

## WebSocket (Game Engine)

Va **directo al Game Engine**, no pasa por el Gateway.

- Endpoint: `http://localhost:8084/ws-game` (SockJS + STOMP)
- Conexión única de toda la app: `src/context/WebSocketContext.jsx`
  (`WebSocketProvider`) + `src/hooks/useWebSocket.js`. Vive por encima del
  router para sobrevivir a la navegación entre pantallas (matchmaking →
  battle) — si cada pantalla abriera su propia conexión habría suscripciones
  duplicadas. Se reconecta sola (`reconnectDelay`) y vuelve a suscribir todo
  lo que estaba activo tras cada reconexión.
- `connect()` devuelve una Promise que resuelve cuando la conexión STOMP
  queda lista (no solo "en progreso").

### Suscripción: `/topic/matchmaking/{userId}`

Payload (`MatchFoundDTO`):

```json
{ "matchId": "uuid", "opponentId": 2, "yourTeam": "TEAM_A" }
```

**CRÍTICO**: hay que estar suscrito ANTES de llamar a `/join`. El servidor
empareja y publica en milisegundos; un mensaje STOMP publicado sin
suscriptores se pierde. El orden correcto (ver `MatchmakingPage`) es:
`await connect()` → `subscribe(...)` → recién ahí `POST /join`.

`src/context/MatchContext.jsx` + `src/hooks/useMatch.js` guardan
`matchId`/`opponentId`/`myTeam` una vez que llega el `MatchFoundDTO`, para
que la pantalla de batalla sepa de qué lado del tablero está el jugador.

## Partida en curso (Game Engine)

### GET /api/games/{matchId}

Directo al Game Engine (8084), sin Gateway. Se usa para recuperar el estado
de una partida cuando el jugador entra por URL a `/battle/{matchId}` sin
haber pasado por matchmaking (el `MatchContext` está vacío en ese caso). La
respuesta trae `players` con `userId`/`team`; `myTeam` se deduce buscando el
propio `userId` ahí.

### Suscripción: `/topic/match/{matchId}`

Snapshot **completo** de la partida, publicado cada ~100ms (no es un delta,
se puede dibujar directo sin acumular estado):

```json
{
  "matchId": "uuid",
  "status": "IN_PROGRESS",
  "remainingSeconds": 178.5,
  "winner": null,
  "players": [
    { "userId": 1, "team": "TEAM_A", "elixir": 5.2, "handCardIds": [1, 2, 4, 6], "nextCardId": 7 }
  ],
  "towers": [
    { "type": "KING", "team": "TEAM_A", "x": 9.0, "y": 2.5, "currentHealth": 4824, "maxHealth": 4824, "destroyed": false }
  ],
  "units": [
    { "instanceId": "uuid", "cardId": 1, "cardName": "Knight", "team": "TEAM_A", "x": 9.0, "y": 5.0, "currentHealth": 1766, "maxHealth": 1766, "state": "MOVING" }
  ]
}
```

`status`: `WAITING` | `IN_PROGRESS` | `FINISHED`. `winner`: `"TEAM_A"` |
`"TEAM_B"` | `null` (empate o partida en curso). Torre `type`: `KING` |
`PRINCESS_LEFT` | `PRINCESS_RIGHT`. Unidad `state`: `MOVING` | `ATTACKING` |
`DEAD`.

`src/pages/Battle/BattlePage.jsx` guarda el último snapshot en un **ref**
(no `useState`) y lo dibuja con un loop de `requestAnimationFrame` en
`src/pages/Battle/drawBoard.js`, incluyendo el HUD (timer/elixir), que se
actualiza escribiendo directo en el DOM vía refs — 10 snapshots/segundo por
`setState` habría sido tirar renders de React a la basura para nada, ya que
el canvas no usa React para pintar.

### Sistema de coordenadas del tablero

`src/utils/coordinates.js`. El tablero mide 18×32 tiles, `TILE = 20px`
(canvas de 360×640). Las posiciones son continuas (`double`), no discretas.
Río en las filas y=15/16, puentes en las columnas x=3 y x=14. Torres fijas:
`TEAM_A` KING (9.0, 2.5) / PRINCESS_LEFT (3.5, 6.5) / PRINCESS_RIGHT (14.5,
6.5); `TEAM_B` KING (9.0, 29.5) / PRINCESS_LEFT (3.5, 25.5) / PRINCESS_RIGHT
(14.5, 25.5) — aunque en la práctica las posiciones de las torres se leen
del snapshot, no de estas constantes.

El jugador local siempre se ve abajo: si `myTeam === 'TEAM_B'` el tablero se
rota 180° (`toCanvas`/`canvasToGame` en `coordinates.js`). Cualquier cosa
que dibuje o interprete clicks en el tablero tiene que pasar por estas dos
funciones, nunca mapear x/y a mano.

## Convenciones del frontend

- `src/api/client.js`: wrapper único de `fetch`. Inyecta el Bearer token,
  normaliza errores del backend (`ApiError` con `status`, `message` y
  `fieldErrors` cuando el backend los manda) y fuerza logout en 401.
- `src/api/*Api.js`: un archivo por microservicio (`authApi`, `profileApi`,
  `deckApi`, `cardApi`), todos construidos sobre `apiClient` — **excepto
  `matchmakingApi` y `gameApi`**, que llaman directo al Game Engine sobre
  `src/api/gameEngineClient.js` (ver Matchmaking / Partida en curso).
- `src/context/AuthContext.jsx` + `src/hooks/useAuth.js`: sesión (token +
  user) persistida en `localStorage`, expone `login`, `register`, `logout`,
  `isAuthenticated`.
- `src/context/ProfileContext.jsx` + `src/hooks/useProfile.js`: perfil del
  usuario autenticado, cargado una vez y compartido entre pantallas.
- `src/context/WebSocketContext.jsx` + `src/hooks/useWebSocket.js`: conexión
  STOMP única de la app (ver WebSocket arriba).
- `src/context/MatchContext.jsx` + `src/hooks/useMatch.js`: datos de la
  partida encontrada (matchId/opponentId/myTeam).
- `src/components/ProtectedRoute`: redirige a `/login` si no hay sesión.
- Rutas: `/login`, `/register`, `/menu`, `/deck`, `/collection`, `/profile`,
  `/leaderboard`, `/matchmaking`, `/battle/:matchId` (todas menos login y
  register están protegidas).
- Variables de entorno: `VITE_API_URL`, `VITE_WS_URL` (ver `.env.example`).
- `npm run manifest` regenera `public/assets/manifest.json` a partir de
  `public/assets/` (ver `scripts/generate-manifest.js`). Correr de nuevo si
  se agregan/quitan sprites.
- Estética: tema oscuro, azules y morados profundos con acentos dorados —
  el objetivo es que se sienta un juego, no un panel de administración.
