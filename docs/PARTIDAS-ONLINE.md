# Partidas online en tiempo real — plan de implementación

> # ⛔ APARCADO — NO ES EL TRABAJO ACTUAL
>
> **El 2026-08-26 se decidió cambiar la estructura del modo online.** La
> prioridad ahora son los **grupos privados con reto diario**, que son
> **asíncronos y no necesitan WebSocket**. Ese trabajo está en
> **`docs/GRUPOS-RETO-DIARIO.md`**, y el índice de contexto en
> `docs/00-EMPEZAR-AQUI.md`.
>
> **No uses este documento como contexto para el trabajo de grupos.** Describe
> una arquitectura de tiempo real que allí no interviene, y solo añade ruido.
>
> Sigue siendo válido y preciso para cuando se retomen las partidas 1v1 (contra
> desconocidos o retando a un amigo) y las de más de dos jugadores dentro de un
> grupo. El backend que describe está terminado. Consérvalo.
>
> Un aviso para entonces: el apartado 3 dice que "el frontend no tiene nada"
> —cierto al escribirlo—, pero para cuando se retome, las Fases 3 y 4 de los
> grupos ya habrán añadido pantallas online nuevas. Revisa el estado real antes
> de fiarte.

---

> **Cómo usar este documento.** Es la especificación completa de lo que falta
> para que funcionen las partidas online. Contiene el estado real de los dos
> repositorios (verificado leyendo el código, no supuesto), los contratos
> exactos del backend, las reglas que no se pueden romper y un plan por fases.
>
> Para retomar el trabajo basta con un prompt del tipo:
> *"Lee `front-colors/docs/PARTIDAS-ONLINE.md` y haz la Fase N"*.
>
> Fecha de la revisión: **2026-08-26**. Si el código ha cambiado mucho desde
> entonces, verifica los apartados 2 y 3 antes de fiarte del plan.

---

## 0. Estado actual — ACTUALIZAR AL TERMINAR CADA SESIÓN

> **Lee esto primero y actualízalo antes de cerrar la sesión.** Es lo único que
> le dice a la siguiente sesión por dónde va la cosa; las casillas del apartado
> 7 son el detalle fino.

| Fase | Estado | Sesión | Notas |
|---|---|---|---|
| 1 — Transporte | ⬜ sin empezar | — | |
| 2 — Estado | ⬜ sin empezar | — | |
| 3 — Pantallas | ⬜ sin empezar | — | |
| 4 — Integración | ⬜ sin empezar | — | |
| 5 — Robustez | ⬜ sin empezar | — | |

**Última actualización:** 2026-08-26 — plan escrito, implementación no iniciada.

### Diario de decisiones

Apunta aquí lo que se decida sobre la marcha y no esté ya en el plan (nombres de
ficheros que se desvíen de lo previsto, cambios de contrato, cosas que se
probaron y no funcionaron). Evita que la siguiente sesión repita el trabajo.

- *(vacío)*

### Presupuesto orientativo

Medido contra una sesión real de referencia (revisión completa de los dos
repositorios más la redacción de este plan: **$10.96**, 19 min de API).

| Fase | Coste estimado | Sesiones |
|---|---|---|
| 1 — Transporte | ~$6-10 | 1 |
| 2 — Estado | ~$10-15 | 1 |
| 3 — Pantallas | ~$18-30 | 1-2 |
| 4 — Integración | ~$10-15 | 1 |
| 5 — Robustez | ~$8 | 1 |

Total de una pasada limpia: **$45-70**; hasta ~$100 si la depuración en dos
dispositivos se complica, que es el escenario realista. La Fase 3 es la única
cuyo coste no está acotado con confianza: conviene empezarla con cuota de sobra.

---

## 1. Resumen en una línea

**El backend está terminado. El frontend no tiene absolutamente nada de tiempo
real.** Todo el trabajo pendiente es de cliente, salvo tres tareas menores de
servidor listadas en el apartado 4.

---

## 2. Estado del backend (`back-colors`) — COMPLETO

Verificado fichero a fichero. Todo esto existe y funciona:

| Pieza | Fichero | Estado |
|---|---|---|
| Motor de partida | `src/game/engine/gameEngine.ts` | Completo: rondas, temporizadores, respuestas, ranking, abandono, reconexión, limpieza |
| Estado y snapshots | `src/game/engine/state.ts` | Completo |
| Eventos de dominio | `src/game/engine/events.ts` | Completo |
| Serialización por partida | `src/game/engine/mutex.ts` | `KeyedMutex`, todas las transiciones van serializadas |
| Modos de juego | `src/game/modes/registry.ts` | Registro extensible. **Solo hay `classic_1v1`** |
| Matchmaking | `src/services/matchmakingService.ts` | Cola implícita sobre la tabla `games`, `FOR UPDATE SKIP LOCKED` |
| Servidor WebSocket | `src/websocket/server.ts` | Socket.IO con auth de handshake, salas, acks, rate limit |
| Protocolo tipado | `src/websocket/protocol.ts` | Tipado en ambas direcciones |
| REST de partidas | `src/routes/index.ts`, `src/controllers/matchController.ts` | 6 endpoints |
| Scoring / XP | `src/game/scoring/score.ts`, `src/game/xp/xp.ts` | Completo |
| Persistencia | `src/repositories/drizzle/gameRepository.ts` | Completo |

**Parámetros de `classic_1v1`** (`src/game/modes/classic1v1.ts`):

```
minPlayers/maxPlayers : 2 / 2
totalRounds           : 5
roundDurationMs       : 15 000
countdownMs           :  3 000
roundResultDelayMs    :  4 000
readyTimeoutMs        : 20 000
```

Más `ANSWER_GRACE_MS = 250` en `gameEngine.ts:32`: holgura de red al cerrar la
ronda. No da ventaja porque el tiempo empleado se recorta a la duración real.

### Límite arquitectónico asumido

El estado vivo de las partidas está **en memoria del proceso**
(`gameEngine.ts:73-84`). El backend debe correr como **una sola instancia**.
Escalar en horizontal exigiría externalizar ese estado (Redis) y un adaptador
compartido de Socket.IO. Está documentado como decisión consciente de la V1; no
lo cambies sin motivo.

---

## 3. Estado del frontend (`front-colors`) — SIN EMPEZAR

Lo que hay hoy del modo online cubre identidad, amigos y rankings. Nada de
partidas:

- **No existe `socket.io-client`** en `package.json`. No hay ninguna conexión
  WebSocket en todo el proyecto.
- `src/api/endpoints.ts:16-24` lo dice explícitamente: *"Solo cubre lo que NO
  necesita WebSocket [...] Las partidas en tiempo real van por Socket.IO y
  llegarán en una segunda fase."*
- `src/app/online/index.tsx:200-209`: la fila "Partida online" del hub está
  pintada pero **`disabled`**, con la etiqueta "en desarrollo".
- `src/app/online/` solo tiene `_layout`, `auth`, `friends`, `index`,
  `leaderboard`, `profile`. **No hay pantalla de partida.**
- `src/api/types.ts` no tiene ningún tipo de partida.

### Lo que SÍ se puede reutilizar

Esto es importante: la parte visual del juego ya está resuelta por el modo
offline y no hay que rehacerla.

| Pieza | Fichero | Nota para el uso online |
|---|---|---|
| Render del SVG con color editable | `src/components/SVGChallenge.tsx` | **Ya acepta la prop `editableColorIndex` que sobreescribe la del asset** (línea 217). Es exactamente lo que necesita una ronda online: el servidor manda el índice |
| Selector de color | `src/components/ColorWheel.tsx` | Reutilizable tal cual |
| Hoja de resultado | `src/components/ResultSheet.tsx` | Base para el resultado de ronda |
| Sistema de diseño | `src/design/*` | `Screen`, `Card`, `Button`, `Pill`, `ProgressBar`, `Stat`, `Avatar`, `ErrorBanner` |
| Catálogo local | `generated/challenges.json` | 137 assets con SVG |
| Sesión y cliente REST | `src/online/session.tsx` | Donde engancha el provider del socket |

**El catálogo está alineado con el backend**: los 137 `id` son idénticos en
`front-colors/generated/challenges.json` y `back-colors/data/assets.json`
(verificado con diff completo). El `assetId` que llega por WebSocket se resuelve
directamente contra el catálogo local. Ver la trampa del apartado 8.1.

---

## 4. Tareas pendientes en el backend (menores)

1. **`GET /api/matches/recent` no existe.** `MatchmakingService.listRecent()`
   (`src/services/matchmakingService.ts:106`) está implementado pero ningún
   endpoint lo expone. Añadir la ruta si el cliente quiere historial.
2. **Cero tests de la capa WebSocket.** Los 75 tests que hay usan repositorios
   en memoria (`tests/helpers.ts:82`) y no arrancan Socket.IO. No hay ninguna
   prueba de integración de `src/websocket/server.ts` ni de los repositorios
   Drizzle contra PostgreSQL.
3. **`CLIENT_ORIGIN` debe incluir el origen real del cliente.** Hoy vale
   `http://localhost:8081,http://localhost:19006,http://localhost:3000`. En
   móvil físico el handshake llega desde otra IP; si se activan comprobaciones
   estrictas de origen habrá que ajustarlo.

---

## 5. Contratos exactos del backend

### 5.1 REST (prefijo `/api`, todos con `Authorization: Bearer <token Clerk>`)

| Método | Ruta | Cuerpo | Devuelve |
|---|---|---|---|
| `GET` | `/matches/modes` | — | `{ modes: [{ id, label, minPlayers, maxPlayers, totalRounds, roundDurationMs }] }` (sin auth) |
| `GET` | `/matches/active` | — | `{ match: MatchView \| null }` |
| `POST` | `/matches` | `{ mode: "classic_1v1" }` | `201 { match: MatchView }` — busca o crea |
| `GET` | `/matches/:id` | — | `{ match: MatchView }` |
| `POST` | `/matches/:id/join` | — | `{ match: MatchView }` |
| `POST` | `/matches/:id/leave` | — | `{ match: MatchView \| null }` |

`MatchView` (`src/services/matchmakingService.ts:19-31`):

```ts
{
  id: string; mode: string; status: string;
  maxPlayers: number; totalRounds: number;
  createdAt: string; startedAt: string | null; finishedAt: string | null;
  players: Array<{
    userId: string; username: string; score: number;
    correctAnswers: number; position: number | null;
    xpEarned: number; joinedAt: string;
  }>;
  live: GameStateSnapshot | null;   // estado vivo del motor, si sigue en memoria
}
```

### 5.2 Handshake del WebSocket

Misma URL que la API (`API_BASE_URL`, sin el prefijo `/api`): Socket.IO comparte
el servidor HTTP. El token va en `auth`:

```ts
io(API_BASE_URL, { auth: { token: await clerk.session.getToken() } })
```

También se acepta la cabecera `Authorization` (`src/websocket/server.ts:69-71`).
Al conectar, el socket entra automáticamente en la sala `user:<userId>`, que es
por donde llega `match_found`.

`pingInterval` y `pingTimeout` son de 20 s. **Rate limit: 60 mensajes por cada
10 s por socket** (`server.ts:33-34`); pasarse devuelve `RATE_LIMITED`.

### 5.3 Cliente → Servidor

Todos aceptan un ack `(response: { ok: true, data } | { ok: false, error: { code, message } })`.

| Evento | Payload | `data` del ack |
|---|---|---|
| `join_game` | `{ gameId }` | `GameStateSnapshot` |
| `ready` | `{ gameId }` | `GameStateSnapshot` |
| `submit_answer` | `{ gameId, round, color: { hex? , hsv? } }` | `{ accepted: true, round, answeredAt }` |
| `leave_game` | `{ gameId }` | `null` |
| `sync` | `{ gameId }` | `GameStateSnapshot` |
| `ping` | — | `{ serverTime }` |

### 5.4 Servidor → Cliente

| Evento | Payload (campos principales) |
|---|---|
| `match_found` | `{ gameId, mode, totalRounds, roundDurationMs, players[] }` |
| `game_state` | `GameStateSnapshot` |
| `game_starting` | `{ gameId, mode, totalRounds, roundDurationMs, countdownMs, startsAt, serverTime, players[] }` |
| `round_started` | `{ gameId, round, totalRounds, assetId, colorIndex, durationMs, startedAt, endsAt, serverTime }` |
| `player_answered` | `{ gameId, round, userId, answeredAt, answeredCount, totalPlayers }` |
| `round_finished` | `{ gameId, round, totalRounds, assetId, colorIndex, targetColor, results[], nextRoundInMs, serverTime }` |
| `game_finished` | `{ gameId, winnerUserId, results[], serverTime }` |
| `player_joined` / `player_left` | `{ gameId, userId, players[], serverTime }` |
| `game_cancelled` | `{ gameId, reason: "abandoned" \| "not_enough_players", serverTime }` |
| `error` | `{ code, message }` |
| `pong` | `{ serverTime }` |

`RoundResultEntry` dentro de `round_finished`:
`{ userId, answered, color, correct, accuracy, distance, roundScore, totalScore, elapsedMs }`

`GameResultEntry` dentro de `game_finished`:
`{ userId, position, score, correctAnswers, outcome: "win"|"loss"|"draw", xpEarned, xpTotal, level }`

`GameStateSnapshot` (`src/game/engine/state.ts:74-92`):

```ts
{
  gameId, mode, status: "starting"|"playing"|"finished"|"cancelled",
  totalRounds, roundDurationMs, serverTime,
  players: PlayerPublicState[],
  currentRound: {
    round, assetId, colorIndex, durationMs,
    startedAt, endsAt, remainingMs, hasAnswered
  } | null
}
```

### 5.5 Flujo completo

```
POST /api/matches {mode}          -> MatchView (status "waiting")
   [espera a que entre el rival]
match_found (por sala user:<id>)  -> gameId
join_game {gameId}                -> game_state + entras en sala game:<id>
ready {gameId}
   [cuando ambos están ready, o a los 20 s de readyTimeout]
game_starting                     -> cuenta atrás de 3 s
round_started (x5)                -> 15 s para responder
   submit_answer {gameId, round, color}
   player_answered                -> feedback "el rival ya ha respondido"
round_finished                    -> revela targetColor + resultados
   [4 s de pausa, luego siguiente round_started]
game_finished                     -> posiciones, XP, nivel
```

---

## 6. Reglas invariables

Romper cualquiera de estas rompe el juego o la arquitectura del proyecto.

1. **La frontera offline/online no se toca.** `ClerkProvider` y
   `SessionProvider` viven solo en `src/app/online/_layout.tsx`. El árbol
   offline (`/`, `/offline`, `/game`, `/party*`) no importa nada de `src/api/`,
   `src/online/` ni `@clerk/expo`. El socket es una dependencia más de `/online`
   y debe respetar lo mismo. Ver `docs/ONLINE.md`.
2. **El color objetivo no llega hasta `round_finished`.** El servidor nunca lo
   manda antes. No lo deduzcas del catálogo local para "adelantar" la UI: sería
   hacer trampas contra tu propio backend.
3. **Usa siempre el `colorIndex` que manda el servidor**, nunca el
   `editableColorIndex` del asset local. Pásalo como prop a `SVGChallenge`, que
   ya soporta la sobreescritura.
4. **El reloj del servidor manda.** Cada payload trae `serverTime`. Calcula el
   desfase con el reloj local al recibir `game_starting` y aplícalo a
   `endsAt`/`startsAt`. No uses `Date.now()` del dispositivo a pelo para el
   contador de la ronda.
5. **Reconectar es `sync`, no `join_game` otra vez.** Tras una caída, `sync`
   devuelve el `GameStateSnapshot` con `remainingMs` y `hasAnswered`.
6. **Una sola respuesta por ronda.** El servidor rechaza la segunda con
   `ALREADY_ANSWERED`. Bloquea el botón en cuanto el ack llegue.
7. **Idioma en tres lenguas.** Toda cadena nueva va a `src/i18n/index.ts` en
   `es`, `en` y `fr`. Nada de texto suelto en las pantallas.

---

## 7. Plan por fases

### Fase 1 — Cimientos del transporte

- [ ] `npx expo install socket.io-client`
- [ ] `src/online/socketTypes.ts` — espejo de `back-colors/src/websocket/protocol.ts`
      y de los payloads de `game/engine/events.ts`. Copiar los tipos a mano
      (los repos no comparten paquete).
- [ ] `src/online/socket.ts` — fábrica del socket tipado:
  - URL = `API_BASE_URL` (de `src/api/config.ts`, sin `/api`)
  - `auth: { token }` con el token fresco de Clerk en cada (re)conexión
  - Reconexión con backoff (Socket.IO la trae; solo hay que configurarla)
  - Renovar el token al reconectar: el de la conexión anterior puede haber
    caducado
- [ ] `src/api/types.ts` — añadir `MatchView`, `MatchPlayerView`, `GameMode`
- [ ] `src/api/endpoints.ts` — añadir la sección `matches` con los 6 endpoints

**Criterio de aceptación:** desde la app, conectar el socket y recibir `pong`.

### Fase 2 — Estado de la partida

- [ ] `src/online/match.tsx` — `MatchProvider` + `useMatch()`, montado dentro de
      `SessionProvider`. Es una máquina de estados:
      `idle → searching → lobby → countdown → playing → roundResult → finished | cancelled`
- [ ] Suscripción a los 12 eventos de servidor, cada uno con su transición
- [ ] Cálculo del desfase de reloj (regla 6.4)
- [ ] Reconexión: `sync` al volver, y al reabrir la app comprobar
      `GET /api/matches/active`

**Criterio de aceptación:** con dos clientes, llegar a `game_finished` sin UI,
solo con logs.

### Fase 3 — Pantallas

- [ ] `src/app/online/match.tsx` — buscar partida y sala de espera:
      `POST /matches`, spinner, jugadores conectados, botón "Listo", cancelar
- [ ] `src/app/online/match/[id].tsx` — juego:
      cuenta atrás, `SVGChallenge` + `ColorWheel`, cronómetro de ronda,
      indicador "el rival ya ha respondido", resultado de ronda con
      `targetColor` revelado
- [ ] Resultado final: posiciones, XP ganado, nivel, revancha / volver al hub
- [ ] Manejo visible de `game_cancelled` y de la desconexión del rival

**Criterio de aceptación:** partida completa entre dos dispositivos.

### Fase 4 — Integración y remates

- [ ] Activar la fila del hub: quitar `disabled` y la píldora "en desarrollo"
      de `src/app/online/index.tsx:200-209`
- [ ] Claves i18n nuevas en `es`/`en`/`fr`
- [ ] Retomar partida en curso al abrir la app (`GET /matches/active`)
- [ ] Sonido y háptica coherentes con el modo offline (`src/utils/sound.ts`,
      `src/utils/haptics.ts`)
- [ ] Actualizar `docs/ONLINE.md` con las pantallas nuevas

### Fase 5 — Robustez (opcional pero recomendable)

- [ ] Tests de la máquina de estados con un socket falso
- [ ] Backend: prueba de integración de la capa WebSocket
- [ ] Backend: `GET /api/matches/recent` + historial en el perfil

---

## 8. Trampas conocidas

### 8.1 Desajuste real en el catálogo de assets

Los 137 `id` coinciden entre los dos repos, pero **10 assets tienen distinto
`editableColorIndex`**:

- 9 (`amazon`, `barbie`, `cocacola`, `google`, `javascript`, `kfc`, `react`,
  `spotify`, `starbucks`) **no tienen el campo** en
  `front-colors/generated/challenges.json`. El backend los normaliza a `0`.
- **`fanta` tiene `editableColorIndex: 3` en el front, pero solo 3 colores**
  (índices válidos 0-2). Está fuera de rango: `challenge.colors[3]` es
  `undefined`. El backend lo recorta a `0`
  (`scripts/generate-assets.ts:145-147` y `src/game/assets/catalog.ts:99-100`),
  así que el servidor está a salvo, pero **el dato del front es inválido y
  probablemente ya falla en offline** (`src/utils/color.ts:203`).

Para el online no es bloqueante — el servidor manda `colorIndex` en cada ronda y
esa es la fuente de verdad (regla 6.3) — pero **conviene arreglar `fanta` en el
generador del front** antes de dar por buena la Fase 3.

### 8.2 Token de Clerk en el socket

El token caduca. El cliente REST ya lo renueva y reintenta ante un 401
(`src/api/client.ts:68-79`). El socket **no tiene ese mecanismo**: hay que pedir
un token nuevo en cada intento de reconexión, no reutilizar el del handshake
inicial.

### 8.3 Un solo proceso de backend

Ver apartado 2. Si algún día hay más de una instancia, el matchmaking emparejará
jugadores cuyo estado vive en procesos distintos y las partidas se romperán en
silencio.

### 8.4 Rate limit del socket

60 mensajes / 10 s. Un `ping` de latencia agresivo o reintentos en bucle de
`sync` pueden agotarlo y provocar `RATE_LIMITED` en mitad de una partida.

### 8.5 El backend solo tiene un modo

`classic_1v1`, 1v1 estricto. La UI no debe prometer otros modos. Añadir uno es
crear un fichero en `back-colors/src/game/modes/` y registrarlo; ni el motor ni
el matchmaking ni el WebSocket necesitan cambios.

---

## 9. Comprobación final

La partida online se considera terminada cuando, con dos dispositivos reales:

1. Ambos entran por "Partida online" y se emparejan solos.
2. Se juegan las 5 rondas con el cronómetro sincronizado en los dos.
3. El color objetivo aparece **solo** al cerrar cada ronda, a la vez en ambos.
4. Matar la app en mitad de una ronda y reabrirla recupera la partida en curso
   con el tiempo restante correcto.
5. Si un jugador abandona, el otro ve el final con el motivo correcto.
6. El XP y el nivel del hub cuadran con lo que dijo `game_finished`.
7. La base de datos refleja la partida: fila en `games`, filas en `game_players`
   con posición y `xp_transactions` con el XP concedido.
