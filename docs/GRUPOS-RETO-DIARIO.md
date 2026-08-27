# Grupos, reto diario y chat — plan de implementación

> **Este es el trabajo activo.** Sustituye a `PARTIDAS-ONLINE.md`, que queda
> aparcado (partidas 1v1 en tiempo real, para más adelante).
>
> Las rutas llevan prefijo de repositorio: `back-colors/...` o
> `front-colors/...`. Ojo, que **el grueso del trabajo ahora es de backend**.
>
> Revisión: **2026-08-26**.

---

## 0. Estado actual — ACTUALIZAR AL TERMINAR CADA SESIÓN

| Fase | Estado | Sesión | Notas |
|---|---|---|---|
| 1 — Backend: grupos y temporadas | ⬜ sin empezar | — | |
| 2 — Backend: reto diario | ⬜ sin empezar | — | |
| 3 — Backend: chat y avisos | ⬜ sin empezar | — | |
| 4 — Front: menú y grupos | ⬜ sin empezar | — | |
| 5 — Front: reto diario | ⬜ sin empezar | — | |
| 6 — Front: chat y avisos | ⬜ sin empezar | — | |
| 7 — Remates | ⬜ sin empezar | — | |

**Última actualización:** 2026-08-26 — plan escrito, implementación no iniciada.

### Diario de decisiones

Apunta aquí lo que se decida sobre la marcha y no esté ya en el plan.

- *(vacío)*

---

## 1. Qué se construye y qué NO

### Sí, ahora

- **Grupos privados**: crear uno, unirse con un código, ver los miembros.
- **Reto diario**: los mismos logos para toda la app, se renueva cada día a las
  **15:00 (Europe/Madrid)**.
- **2 intentos por jugador y día**, cuenta el mejor.
- **Clasificación del grupo**: acumulado de una temporada de **10 días** que
  arranca al crear el grupo.
- **Fin de temporada**: pasados los 10 días el grupo queda **desactivado para
  competir**, pero **el chat sigue vivo**.
- **Renovación**: el creador puede reiniciar la temporada. Se reinician los 10
  días y la clasificación del grupo; **el XP y el nivel de cada persona no se
  tocan nunca**.
- **Aviso a los miembros** cuando el grupo se renueva.
- **Chat del grupo**: conversación simple entre miembros.
- **XP y nivel** por el reto diario.

### No, todavía

Decididas a nivel de producto pero **no se implementan**. No las construyas ni
las prometas en la UI más allá de una fila deshabilitada:

- Partidas rápidas 1v1 contra desconocidos.
- Retar a un amigo a un 1v1.
- Partidas en tiempo real de más de dos jugadores dentro de un grupo.

Viven en `PARTIDAS-ONLINE.md`, que **está aparcado**. No lo leas para este
trabajo: describe una arquitectura de WebSocket que aquí no hace falta.

### Lo que ya existe y se mantiene

Perfil, amigos y rankings globales funcionan y se quedan como están, pero pasan
a un plano **secundario** dentro del menú nuevo.

---

## 2. La idea, en una frase

Un Wordle competitivo entre amigos: **un mismo reto para todos cada día**, dos
intentos, una clasificación privada por grupo que acumula 10 días, y un chat
donde picarse mientras tanto.

La referencia de producto es **Playus**: inicio con el reto del día, pantalla de
preparación explicando qué toca, el juego, la puntuación y el ranking del grupo
con podio muy visual.

---

## 3. Decisiones ya cerradas

Tomadas el 2026-08-26. **No las reabras sin preguntar.**

| Decisión | Elegido | Por qué |
|---|---|---|
| Corte diario | **15:00 en `Europe/Madrid`**, fijo para todo el mundo | Todos ven el mismo reto a la vez; el ranking del día es comparable |
| Temporada | **10 días por grupo, desde su creación** | Quien crea un grupo hoy compite 10 días completos |
| Logos del día | **Los mismos para toda la app** | Un único reto global, como Playus o Wordle |
| XP | **Sí, según la posición del día** | Sin esto el nivel se congelaría |
| Chat | **Sondeo periódico, sin WebSocket** | Coherente con que todo este trozo sea asíncrono; ahorra el cliente de Socket.IO entero |
| Avisos | **Dentro de la app ahora, preparados para push después** | El push es un subsistema aparte; el modelo de datos ya lo contempla |

### 3.1 Derivada: el jugador juega UNA vez al día

Como el reto es global, **los intentos son por jugador y día, no por grupo**. Si
estás en tres grupos, juegas una sola vez y tu mejor puntuación cuenta en los
tres. Es el modelo de Playus, evita repetir el mismo reto y hace imposible
farmear.

En consecuencia, `daily_attempts` **no lleva `group_id`**.

### 3.2 Derivada: el XP se concede una vez al día

Si el XP dependiera del puesto *dentro de cada grupo*, estar en muchos grupos lo
multiplicaría. Para evitarlo: **una sola concesión diaria por jugador**,
calculada sobre su posición en el **ranking global del reto de ese día**.

> Esto se separa un poco de "posición del día dentro del grupo". Se hizo así
> para cerrar el agujero de farmeo. Si prefieres lo otro, dilo antes de la
> Fase 2.

### 3.3 Derivada: reiniciar la clasificación no borra nada

Como los intentos son globales y la clasificación del grupo se calcula
**filtrando por la ventana de la temporada**, renovar un grupo es simplemente
abrir una ventana nueva. **No se borra ni una fila.** El historial de temporadas
anteriores queda consultable, y el XP y el nivel —que viven en `users` y
`xp_transactions`— ni se rozan.

### 3.4 Derivada: el estado del grupo se calcula, no se guarda

`activo` o `terminado` se deriva de comparar `now()` con el fin de la temporada
actual. **Nada de un campo `status` que haya que actualizar con un cron a las
15:00**: sería una pieza más que se puede quedar colgada si el servidor está
apagado.

---

## 4. Modelo de datos (nuevo, en `back-colors`)

Seis tablas nuevas en `back-colors/src/db/schema.ts`. Ninguna toca las
existentes; `users` se referencia igual que hacen `friendships` y
`game_players`.

```
groups
  id              uuid pk
  name            text            (2-40 caracteres)
  join_code       text unique     (6 caracteres, ver 4.1)
  owner_user_id   uuid -> users.id
  created_at      timestamptz

group_seasons                     -- una fila por temporada, incluida la actual
  id              uuid pk
  group_id        uuid -> groups.id   ┐ único
  season_number   integer             ┘ (1, 2, 3...)
  starts_at       timestamptz
  ends_at         timestamptz         (starts_at + 10 días)
  created_at      timestamptz
  -- la temporada actual es la de season_number más alto

group_members
  group_id        uuid -> groups.id   ┐ pk compuesta
  user_id         uuid -> users.id    ┘
  joined_at       timestamptz
  role            enum('owner','member')

daily_challenges
  id              uuid pk
  challenge_date  date unique     (la jornada; ver 4.2)
  opens_at        timestamptz     (challenge_date a las 15:00 Europe/Madrid)
  closes_at       timestamptz     (opens_at + 24 h)
  rounds          jsonb           ([{ assetId, colorIndex }, ...])
  created_at      timestamptz

daily_attempts
  id                  uuid pk
  daily_challenge_id  uuid -> daily_challenges.id  ┐ único junto con
  user_id             uuid -> users.id             │ attempt_number
  attempt_number      smallint (1 o 2)             ┘
  score               integer
  details             jsonb    ([{ round, color, accuracy, roundScore }, ...])
  created_at          timestamptz

group_messages
  id              uuid pk
  group_id        uuid -> groups.id
  user_id         uuid -> users.id
  body            text            (1-500 caracteres, ya recortado)
  created_at      timestamptz

notifications
  id              uuid pk
  user_id         uuid -> users.id
  group_id        uuid -> groups.id   (nullable: habrá avisos sin grupo)
  type            text                ('season_renewed', ...)
  payload         jsonb
  created_at      timestamptz
  read_at         timestamptz null
  pushed_at       timestamptz null    -- ver 4.4
```

Índices imprescindibles: `group_members(user_id)` para "mis grupos",
`daily_attempts(daily_challenge_id, user_id)` para el ranking,
`group_messages(group_id, created_at desc)` para el chat, y
`notifications(user_id, read_at)` para el contador de no leídos.

### 4.1 Código de grupo

6 caracteres, mayúsculas, **excluyendo los ambiguos** `0 O 1 I L`. Alfabeto
sugerido: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. Generar y reintentar ante colisión
(la restricción `unique` es la red de seguridad). Se compara siempre en
mayúsculas: normaliza la entrada del usuario.

### 4.2 La jornada y las 15:00

`challenge_date` identifica la jornada: la fecha del día en que abrió, en hora
de Madrid. La jornada del `2026-08-26` va **del 26 a las 15:00 al 27 a las
15:00**, hora de Madrid.

**Cuidado con el horario de verano.** Madrid es UTC+1 o UTC+2 según la época, y
sumar horas fijas falla dos veces al año. El backend no tiene librería de zonas
horarias; usa **PostgreSQL**, que sí sabe:

```sql
-- jornada correspondiente a un instante dado
SELECT ($1::timestamptz AT TIME ZONE 'Europe/Madrid' - interval '15 hours')::date;

-- momento de apertura de una jornada
SELECT (challenge_date + interval '15 hours') AT TIME ZONE 'Europe/Madrid';
```

**Fíjate en que el instante entra como parámetro `$1`, no como `now()`.** Es
deliberado y obligatorio: ver 5.4.

### 4.3 Generación del reto

**Bajo demanda, no con un cron.** La primera petición del día que no encuentre
reto para la jornada actual lo crea. Cero infraestructura, y el servidor puede
estar apagado sin dejar huecos.

- Semilla determinista a partir de `challenge_date`, para que sea reproducible.
- Los logos salen del catálogo del backend (`back-colors/data/assets.json`,
  137 assets) reutilizando `src/game/assets/selector.ts`.
- **5 rondas** por reto. Es un parámetro: déjalo en una constante.
- Insertar con `ON CONFLICT (challenge_date) DO NOTHING` y releer, para que una
  carrera entre dos peticiones no cree dos retos.

### 4.4 Por qué `pushed_at` existe desde el principio

Los avisos de esta tanda son **dentro de la app**: el cliente lee la tabla
`notifications` y pinta un punto rojo. Pero la columna `pushed_at` se añade ya,
vacía, para que el día que se implemente el push real solo haya que escribir el
emisor —que buscará filas con `pushed_at IS NULL`— sin migración ni rediseño.

**No implementes el envío push en esta tanda.** Solo la columna.

---

## 5. Ciclo de vida del grupo y control de acceso

Esta es la parte más fácil de hacer mal. Léela entera antes de escribir un
endpoint de grupo.

### 5.1 Los dos estados

```
ACTIVO      now() <  temporada_actual.ends_at
TERMINADO   now() >= temporada_actual.ends_at
```

Derivado, nunca almacenado (3.4).

### 5.2 Qué se puede hacer en cada estado

| Acción | Miembro, activo | Miembro, terminado | No miembro |
|---|---|---|---|
| Ver el grupo y sus miembros | ✅ | ✅ | ❌ 403 |
| Ver la clasificación | ✅ en vivo | ✅ **congelada** | ❌ 403 |
| Leer y escribir en el chat | ✅ | ✅ **sigue activo** | ❌ 403 |
| Ver el historial de temporadas | ✅ | ✅ | ❌ 403 |
| Salirse del grupo | ✅ | ✅ | — |
| **Renovar la temporada** | ❌ 409 | ✅ **solo el `owner`** | ❌ 403 |
| Unirse con el código | — | ✅ se puede entrar igual | ✅ es la puerta |

Reglas que se derivan y hay que respetar:

1. **El chat nunca se bloquea por el estado de la temporada.** Es el punto
   central de esta tanda: un grupo terminado sigue siendo un sitio donde hablar.
2. **Renovar solo con la temporada terminada.** Permitirlo en mitad de una
   competición dejaría al `owner` reiniciar la clasificación cuando va perdiendo.
   Con temporada activa, `POST /renew` devuelve `409 SEASON_STILL_ACTIVE`.
3. **Renovar es solo del `owner`.** Cualquier otro miembro recibe `403`.
4. **Cualquier endpoint de grupo comprueba la pertenencia primero.** El código
   de invitación es la única puerta de entrada.

### 5.3 El reto diario NO depende del grupo

`GET /daily` y `POST /daily/attempts` son **globales**: no llevan grupo y no se
bloquean aunque todos tus grupos estén terminados. Se sigue pudiendo jugar y se
sigue ganando XP (3.2); simplemente la puntuación no suma en ninguna
clasificación hasta que alguien renueve.

En la app conviene avisarlo: si el jugador no tiene ningún grupo activo, el reto
se puede jugar pero hay que decirle que no cuenta para ninguna clasificación.

### 5.4 El reloj del backend — una sola fuente de la hora

**Toda la lógica de fechas pregunta la hora a un único sitio**, un servicio
`Clock` inyectado como cualquier otra dependencia (`src/container.ts`):

```ts
export interface Clock {
  now(): Date;
}
```

**Prohibido en la lógica de dominio:**

- `Date.now()` y `new Date()` sueltos.
- `now()` de PostgreSQL dentro de consultas de temporadas o jornadas.
- `defaultNow()` en las columnas que le importan al dominio
  (`group_seasons.starts_at` y `ends_at`, `daily_attempts.created_at`,
  `daily_challenges.*`). Esos valores se pasan explícitamente desde el `Clock`.

Motivo doble: sin esto **no se puede viajar en el tiempo para probar** (5.5), y
tampoco se pueden escribir los tests de cambio de horario que exige la Fase 2.
`created_at` de tablas puramente informativas (`groups`, `group_messages`) sí
puede usar el valor por defecto de la base de datos.

En producción la implementación es trivial: `now: () => new Date()`.

### 5.5 Cómo probar el ciclo sin esperar 10 días

Hacen falta **dos mecanismos**, porque resuelven cosas distintas. Ambos son
**exclusivos de desarrollo**.

#### a) Duración de temporada configurable

La duración deja de ser una constante y pasa a `src/config/env.ts`:

```
SEASON_DURATION_MS=864000000     # 10 días, valor por defecto
```

Para una prueba rápida del ciclo completo se pone a `300000` (5 minutos) y se ve
nacer, terminar y renovar un grupo sin tocar nada más. Es lo más cómodo para
comprobar de un vistazo que la transición funciona.

#### b) Viaje en el tiempo (recomendado para lo fino)

El `Clock` de desarrollo mantiene un **desfase** en memoria que se suma al
tiempo real, y se manipula con endpoints:

| Método | Ruta | Cuerpo | Qué hace |
|---|---|---|---|
| `GET` | `/api/dev/time` | — | Devuelve el desfase y el "ahora" efectivo |
| `POST` | `/api/dev/time/advance` | `{ days?, hours?, minutes? }` | Suma al desfase. **El botón de "pasar un día"** |
| `POST` | `/api/dev/time/set` | `{ iso }` | Salta a una fecha concreta |
| `POST` | `/api/dev/time/reset` | — | Vuelve al tiempo real |
| `POST` | `/api/dev/groups/:id/season/end` | — | Termina la temporada del grupo **ya**, sin tocar el reloj global |

Con esto se prueba lo que la duración configurable no alcanza: saltar al día 7 y
ver la clasificación a medias, cruzar el corte de las 15:00 para ver aparecer el
reto nuevo, plantarse en el último domingo de octubre para verificar el horario
de verano, o ir al día 10 y comprobar que el grupo se desactiva pero el chat
sigue vivo.

`POST /api/dev/groups/:id/season/end` existe porque es lo más habitual: cambiar
el reloj global afecta también a las jornadas del reto diario, y muchas veces
solo quieres ver el estado *terminado* de un grupo concreto.

#### Cómo se protege

Esto abre un agujero enorme si se escapa a producción. **No basta con devolver
403**: el router de `/api/dev` **no se monta siquiera** salvo que se cumplan las
dos condiciones a la vez:

```ts
const devToolsEnabled =
  env.NODE_ENV !== "production" && env.DEV_TIME_TRAVEL === true;
```

Con eso, en producción las rutas devuelven `404` como cualquier ruta inexistente
y ni se puede sondear si existen. Y `DEV_TIME_TRAVEL` va a `.env.example`
comentada y en `false`.

> El desfase vive en memoria del proceso: reiniciar el backend vuelve al tiempo
> real. Es lo que quieres, y encaja con que el backend sea de una sola
> instancia.

### 5.6 Qué pasa exactamente al renovar

`POST /groups/:id/renew`, y solo eso:

1. Inserta una fila en `group_seasons` con `season_number + 1`,
   `starts_at = now()`, `ends_at = now() + 10 días`.
2. Inserta una fila en `notifications` **por cada miembro** del grupo, con
   `type = 'season_renewed'`.
3. Devuelve el grupo con la temporada nueva.

Y lo que **no** hace, que es igual de importante:

- **No borra `daily_attempts`.** La clasificación se reinicia sola porque la
  consulta filtra por la ventana de la temporada actual (3.3).
- **No toca `users.xp` ni `users.level` ni `xp_transactions`.** El progreso
  personal es intocable.
- **No borra los mensajes del chat.** La conversación continúa entre temporadas.
- **No expulsa a nadie.** Los miembros siguen dentro.

---

## 6. Reglas invariables

1. **La puntuación la calcula el servidor, siempre.** El cliente manda los
   colores elegidos por ronda; el backend recalcula con
   `src/game/colors/compare.ts` y `src/game/scoring/score.ts`. Si el cliente
   mandara la puntuación, el juego sería trivial de romper.
2. **El color objetivo no se manda antes de tiempo.** El reto se entrega como
   `[{ assetId, colorIndex }]`; los objetivos solo viajan al cerrar el intento.
3. **Máximo 2 intentos por jugador y jornada**, con restricción `unique` más una
   comprobación explícita que devuelva un error claro.
4. **Fuera de la ventana no se juega.**
5. **Un grupo solo se ve desde dentro**, en cualquier estado.
6. **El XP y el nivel individuales no se reinician jamás.**
7. **La frontera offline/online no se toca.** `ClerkProvider` y
   `SessionProvider` siguen viviendo solo en
   `front-colors/src/app/online/_layout.tsx`.
8. **Tres idiomas.** Toda cadena visible va a `front-colors/src/i18n/index.ts`
   en `es`, `en` y `fr`.
9. **Una sola fuente de la hora.** Toda la lógica de fechas pasa por el `Clock`
   (5.4). Nada de `Date.now()` suelto ni de `now()` de SQL en el dominio.
10. **Las herramientas de desarrollo no existen en producción.** El router
    `/api/dev` ni se monta si no se cumplen las dos condiciones de 5.5.

---

## 7. API REST (nueva, prefijo `/api`)

Todas con `Authorization: Bearer <token Clerk>`.

### Grupos y temporadas

| Método | Ruta | Cuerpo | Devuelve |
|---|---|---|---|
| `GET` | `/groups` | — | `{ groups: GroupSummary[] }` — los míos, con estado y avisos sin leer |
| `POST` | `/groups` | `{ name }` | `201 { group }` — me hace `owner`, crea la temporada 1 |
| `POST` | `/groups/join` | `{ code }` | `{ group }` |
| `GET` | `/groups/:id` | — | `{ group }` — incluye `status`, temporada actual y miembros |
| `GET` | `/groups/:id/leaderboard` | — | `{ entries, season }` |
| `GET` | `/groups/:id/seasons` | — | `{ seasons: [...] }` — historial |
| `POST` | `/groups/:id/renew` | — | `{ group }` — solo `owner`, solo si terminó |
| `DELETE` | `/groups/:id/members/me` | — | `204` |

### Chat

| Método | Ruta | Parámetros | Devuelve |
|---|---|---|---|
| `GET` | `/groups/:id/messages` | `?before=<id>&limit=50` | `{ messages, hasMore }` — página de historial |
| `GET` | `/groups/:id/messages` | `?after=<id>` | `{ messages }` — solo los nuevos, para el sondeo |
| `POST` | `/groups/:id/messages` | `{ body }` | `201 { message }` |

Los mensajes llegan del más nuevo al más viejo en el modo `before`, y en orden
cronológico en el modo `after`. Cada mensaje incluye el autor
(`{ userId, username }`) para no obligar a otra petición.

Límites: **500 caracteres** por mensaje, recortado y validado en el servidor, y
un limitador de ritmo propio (sugerido: **20 mensajes por minuto**) montado
sobre `src/middleware/rateLimit.ts`. Sin editar ni borrar mensajes en esta
tanda.

### Avisos

| Método | Ruta | Cuerpo | Devuelve |
|---|---|---|---|
| `GET` | `/notifications` | `?unreadOnly=true` | `{ notifications, unreadCount }` |
| `POST` | `/notifications/read` | `{ ids?: string[] }` | `{ unreadCount }` — sin `ids`, marca todo |

### Reto diario

| Método | Ruta | Cuerpo | Devuelve |
|---|---|---|---|
| `GET` | `/daily` | — | `{ challenge, attemptsUsed, bestScore, closesAt }` |
| `POST` | `/daily/attempts` | `{ answers: [{ round, hsv }] }` | `{ attempt, best, xpEarned, position }` |

`challenge` entrega `{ id, challengeDate, opensAt, closesAt, rounds: [{ round, assetId, colorIndex }] }`. **Sin colores objetivo.** La respuesta del `POST` sí
incluye, ya cerrado el intento, el desglose por ronda con el objetivo, la
precisión y los puntos.

### Herramientas de desarrollo

`GET/POST /api/dev/time/*` y `POST /api/dev/groups/:id/season/end`, detalladas
en **5.5**. Solo existen fuera de producción y con `DEV_TIME_TRAVEL=true`.

### Variables de entorno nuevas

En `back-colors/src/config/env.ts` y en `.env.example`:

```
# Duración de una temporada de grupo. 10 días por defecto.
# Bájalo (p. ej. 300000 = 5 min) para ver el ciclo completo en una prueba.
SEASON_DURATION_MS=864000000

# Herramientas de viaje en el tiempo. NUNCA en producción.
# DEV_TIME_TRAVEL=true
```

### Códigos de error nuevos

Para `back-colors/src/errors/appError.ts`:

`GROUP_NOT_FOUND`, `GROUP_CODE_INVALID`, `ALREADY_MEMBER`, `NOT_A_MEMBER`,
`NOT_GROUP_OWNER`, `SEASON_STILL_ACTIVE`, `DAILY_CLOSED`, `NO_ATTEMPTS_LEFT`,
`MESSAGE_TOO_LONG`.

---

## 8. Pantallas (en `front-colors`)

El hub deja de ser una lista plana y pasa a ser un **menú de cómo jugar**, con
lo social en segundo plano:

```
/online                          menú: ¿cómo quieres jugar?
│
├─ Partida rápida                 fila DESHABILITADA, "próximamente"
│
├─ /online/groups                 mis grupos · crear · unirse con código
│   ├─ /online/groups/[id]           reto de hoy + clasificación + miembros + acceso al chat
│   ├─ /online/groups/[id]/play      el reto (2 intentos)
│   └─ /online/groups/[id]/chat      la conversación
│
└─ Secundario (ya existen, se mantienen)
    ├─ /online/friends
    ├─ /online/leaderboard
    └─ /online/profile
```

Crear y unirse a un grupo deben ser accesibles **también desde el menú
principal**, no solo desde dentro de la lista de grupos.

### Estados que la UI tiene que cubrir

- **Grupo activo**: reto de hoy, días restantes de temporada, clasificación en
  vivo, chat.
- **Grupo terminado**: clasificación **congelada** con el podio final, chat
  igual de accesible, y —solo si eres el `owner`— un botón de **renovar**. Al
  resto de miembros hay que decirles que el grupo está terminado y que solo el
  creador puede reiniciarlo.
- **Sin ningún grupo activo**: el reto diario se puede jugar, pero avisando de
  que no cuenta para ninguna clasificación (5.3).
- **Sin intentos**, **reto cerrado**, y cuenta atrás al próximo.
- **Aviso de renovación**: punto rojo en la fila del grupo y una línea dentro
  del grupo. Se marca leído al abrirlo.

### El chat, en concreto

Lista invertida, burbujas propias y ajenas, avatar y nombre del autor. **Sondeo
mientras la pantalla está en primer plano** (sugerido cada 5 s con `after=`), y
**parar el sondeo al salir de la pantalla o al pasar la app a segundo plano** —
si no, se consume batería y ritmo de peticiones sin que nadie lo esté mirando.
Historial hacia arriba con `before=`.

### Qué se reutiliza

La parte de juego **no se escribe de cero**:

| Pieza | Fichero | Nota |
|---|---|---|
| Render del logo | `src/components/SVGChallenge.tsx` | Acepta la prop `editableColorIndex`, que es la que manda el servidor |
| Selector de color | `src/components/ColorWheel.tsx` | Tal cual |
| Hoja de resultado | `src/components/ResultSheet.tsx` | Base del resultado de intento |
| Bucle de juego | `src/app/game.tsx` | **Referencia visual**, no reutilizar tal cual |
| Sistema de diseño | `src/design/*` | `Screen`, `Card`, `Button`, `Pill`, `Stat`, `Avatar`, `ProgressBar` |

**`useChallenge` no vale sin tocarlo**: elige los logos localmente. Para el reto
diario hace falta un hook nuevo (`useDailyChallenge`) que reciba las rondas ya
resueltas del servidor.

---

## 9. Plan por fases

### Fase 1 — Backend: grupos y temporadas

- [ ] **Servicio `Clock` (5.4)** inyectado desde `src/container.ts`, con la
      implementación real y la de desarrollo con desfase
- [ ] **`SEASON_DURATION_MS` y `DEV_TIME_TRAVEL`** en `src/config/env.ts` y en
      `.env.example`
- [ ] **Router `/api/dev`** con los endpoints de tiempo (5.5), montado solo si
      procede
- [ ] Tablas `groups`, `group_seasons` y `group_members` + migración
- [ ] Generador de códigos (4.1) con reintento ante colisión
- [ ] `GroupRepository` (Drizzle + memoria)
- [ ] `GroupService`: crear, unirse por código, listar, detalle, salir, **renovar**
- [ ] Estado `activo`/`terminado` derivado (3.4) y **control de acceso del 5.2**
- [ ] `POST /api/dev/groups/:id/season/end` para terminar una temporada al vuelo
- [ ] Códigos de error nuevos, controlador y rutas
- [ ] Tests con repositorios en memoria, al estilo de `tests/friends.test.ts`,
      usando un `Clock` falso para simular el paso de los días

**Aceptación:** dos usuarios, uno crea grupo y el otro entra con el código. Un
tercero sin código recibe `GROUP_NOT_FOUND`. Con la temporada forzada a
terminada, renovar funciona solo para el `owner` y crea la temporada 2; con la
temporada activa devuelve `SEASON_STILL_ACTIVE`.

**Y sobre todo:** con `DEV_TIME_TRAVEL=true`, un `POST /api/dev/time/advance
{ "days": 10 }` debe dejar el grupo en estado `terminado` sin reiniciar el
servidor ni esperar. Con `NODE_ENV=production` esa ruta debe devolver `404`.

### Fase 2 — Backend: reto diario

- [ ] Tablas `daily_challenges` y `daily_attempts` + migración
- [ ] Cálculo de la jornada con `AT TIME ZONE` (4.2) **alimentado por el `Clock`,
      nunca por `now()` de SQL**, con **tests de cambio de hora**
- [ ] Generación bajo demanda con semilla determinista (4.3)
- [ ] `GET /daily` y `POST /daily/attempts` con validación de ventana e intentos
- [ ] Puntuación **en el servidor** reutilizando `compare.ts` y `score.ts`
- [ ] XP diario único por jugador (3.2), reutilizando `game/xp/xp.ts`
- [ ] `GET /groups/:id/leaderboard` filtrando por la ventana de la temporada
- [ ] `GET /groups/:id/seasons`

**Aceptación:** jugar dos intentos, ver que cuenta el mejor y que aparece en la
clasificación. Tras renovar, la clasificación sale a cero **sin que se haya
borrado ningún intento**, y el XP del jugador sigue intacto.

**Con viaje en el tiempo:** avanzar un día debe hacer aparecer un reto nuevo con
otros logos y devolver los dos intentos. Avanzar hasta cruzar el último domingo
de octubre no debe descuadrar la jornada.

### Fase 3 — Backend: chat y avisos

- [ ] Tablas `group_messages` y `notifications` (con `pushed_at`, ver 4.4) + migración
- [ ] `GET /groups/:id/messages` en sus dos modos (`before` y `after`)
- [ ] `POST /groups/:id/messages` con límite de 500 caracteres y de ritmo
- [ ] **El chat funciona con la temporada terminada** (regla 5.2.1)
- [ ] Avisos: creación al renovar, `GET /notifications`, `POST /notifications/read`
- [ ] Tests: no miembro rechazado, chat vivo tras terminar, aviso a todos al renovar

**Aceptación:** dos miembros conversan; con la temporada terminada el chat
sigue funcionando; renovar deja un aviso sin leer a cada miembro.

### Fase 4 — Frontend: menú y grupos

- [ ] Rehacer `src/app/online/index.tsx` como menú de "cómo jugar"
- [ ] Fila de partida rápida visible pero deshabilitada
- [ ] Tipos y endpoints nuevos en `src/api/types.ts` y `src/api/endpoints.ts`
- [ ] `/online/groups`: lista, crear, unirse con código
- [ ] `/online/groups/[id]`: miembros, reto de hoy, clasificación con podio
- [ ] Estado terminado con podio congelado y botón de renovar solo para el `owner`
- [ ] Amigos, ranking y perfil pasan a secundario
- [ ] **Panel de desarrollo bajo `__DEV__`** (dentro de ajustes o del grupo) con
      botones de "avanzar 1 día", "avanzar 10 días", "terminar esta temporada" y
      "volver al tiempo real", contra los endpoints de 5.5. Es lo que convierte
      la prueba del ciclo en un par de toques en vez de `curl`

**Aceptación:** crear un grupo desde la app y que otro dispositivo entre con el
código. Un grupo terminado se ve como tal, y solo su creador ve el botón.

### Fase 5 — Frontend: el reto diario

- [ ] `useDailyChallenge`: rondas del servidor, sin selección local
- [ ] Pantalla de preparación (qué toca hoy, intentos restantes)
- [ ] Pantalla de juego reutilizando `SVGChallenge` y `ColorWheel`
- [ ] Envío del intento y resultado con desglose por ronda
- [ ] Estados: sin intentos, reto cerrado, cuenta atrás, **sin grupo activo** (5.3)

**Aceptación:** partida diaria completa desde la app, con la clasificación
actualizándose.

### Fase 6 — Frontend: chat y avisos

- [ ] `/online/groups/[id]/chat` con lista invertida y burbujas
- [ ] Sondeo con `after=` mientras la pantalla está en primer plano, **y parado
      al salir o al pasar a segundo plano**
- [ ] Historial hacia arriba con `before=`
- [ ] Punto rojo de avisos sin leer en la lista de grupos y dentro del grupo
- [ ] Marcar leído al abrir

**Aceptación:** dos dispositivos conversan y los mensajes aparecen en segundos.
Renovar un grupo deja el punto rojo al resto de miembros.

### Fase 7 — Remates

- [ ] i18n en `es`, `en`, `fr` de todo lo nuevo
- [ ] XP y nivel del reto reflejados en el perfil
- [ ] Repaso del fin de temporada de punta a punta
- [ ] Actualizar `docs/ONLINE.md` con la estructura nueva

---

## 10. Trampas conocidas

- **El chat no se bloquea nunca por el estado de la temporada.** Es el error más
  fácil de cometer: se pone una guarda de "grupo activo" genérica en todos los
  endpoints del grupo y el chat muere con la temporada. Ver 5.2.
- **Renovar no borra nada.** Si te ves escribiendo un `DELETE FROM
  daily_attempts`, párate: la clasificación se reinicia moviendo la ventana
  (3.3). Borrar romperia el XP ya concedido y las demás temporadas.
- **`DEV_ONLY_LOGOS` está puesto a `["fanta"]`** en
  `front-colors/src/hooks/useChallenge.ts:28` (en git es `null`). Restringe el
  catálogo entero a fanta. **Es deliberado; no lo revierta nadie sin
  preguntar.** No afecta al reto diario si los logos vienen del servidor.
- **`fanta` tiene `editableColorIndex: 3` con solo 3 colores.** El backend lo
  recorta a 0 al cargar el catálogo, así que el reto diario está a salvo. El
  dato del front sigue mal.
- **Horario de verano.** El fallo más probable de la Fase 2. Escribe tests que
  crucen el último domingo de marzo y el de octubre.
- **Un `now()` de SQL que se cuela.** Si una sola consulta de temporadas o
  jornadas usa `now()` de PostgreSQL en vez del `Clock`, el viaje en el tiempo
  funcionará *a medias*: unas cosas avanzarán y otras no, y el resultado será
  incoherente y desquiciante de depurar. Lo mismo con un `defaultNow()` en una
  columna que le importe al dominio. Ver 5.4.
- **Las rutas `/api/dev` en producción.** Permiten a cualquiera mover el reloj
  del servidor. No basta con un `403`: el router no debe montarse siquiera
  (5.5). Comprueba explícitamente que con `NODE_ENV=production` devuelven `404`.
- **El desfase del reloj se pierde al reiniciar el backend.** Es lo buscado,
  pero si estás probando y reinicias `npm run dev`, vuelves al tiempo real y
  parecerá que el grupo ha "resucitado".
- **Empates en la clasificación.** Dos jugadores con los mismos puntos comparten
  puesto. Hay un precedente resuelto en
  `back-colors/src/game/engine/gameEngine.ts` (`rankPlayers`): copia el criterio
  aunque no reutilices el código.
- **El sondeo del chat hay que pararlo.** Si sigue corriendo con la pantalla
  cerrada o la app en segundo plano, gasta batería y se come el limitador.
- **El catálogo debe estar sincronizado.** Los 137 `id` coinciden hoy entre
  `back-colors/data/assets.json` y `front-colors/generated/challenges.json`. Si
  se regenera uno, hay que regenerar el otro (`npm run generate:assets`).
- **Para probar de verdad hacen falta dos cuentas de Clerk.** Las fichas del
  seed (`alice`, `bob`...) no sirven para iniciar sesión.
