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
| 1 — Backend: grupos y temporadas | ✅ hecha | 2026-08-27 | El aviso `season_renewed` que quedaba pendiente ya está, con la Fase 3 |
| 2 — Backend: reto diario | ✅ hecha | 2026-08-27 | |
| 3 — Backend: chat y avisos | ✅ hecha | 2026-08-27 | Backend completo: las tres fases de servidor están cerradas |
| 4 — Front: menú y grupos | ✅ hecha | 2026-08-27 | Falta probarla a mano en un dispositivo con dos cuentas de Clerk |
| 5 — Front: reto diario | ✅ hecha | 2026-08-28 | Falta probarla a mano, igual que la 4 |
| 6 — Front: chat y avisos | ⬜ sin empezar | — | |
| 7 — Remates | ⬜ sin empezar | — | |

**Última actualización:** 2026-08-28 — **Backend completo (fases 1-3) y Fases 4
y 5 del frontend hechas: el reto diario ya se juega desde la app.** En
`back-colors`, `npm test` pasa (213 tests). En `front-colors`, `npx tsc
--noEmit` y `npm run lint` pasan limpios. Lo siguiente es la Fase 6, el chat.

> **Ojo:** ni la Fase 4 ni la Fase 5 **se han probado a mano**. Hace falta un
> dispositivo o simulador y **dos cuentas de Clerk reales** para comprobar los
> criterios de aceptación (crear un grupo en una y entrar con el código desde
> la otra; jugar los dos intentos y ver moverse la clasificación). Lo que sí
> está verificado por otras vías está más abajo.

**Fase 1** (`back-colors`): `src/services/clock.ts` con `Clock`, `systemClock` y
`DevClock`, inyectado desde `src/container.ts`; `SEASON_DURATION_MS` y
`DEV_TIME_TRAVEL` en `src/config/env.ts` con `env.devToolsEnabled`;
`src/routes/dev.ts` montado solo si procede; tablas `groups`, `group_seasons` y
`group_members` (`drizzle/0002_groups.sql`); `GroupRepository`, `GroupService`,
controlador y rutas `/api/groups*`.

**Fase 2**: `src/game/daily/calendar.ts` (la jornada, el corte de las 15:00 y la
semilla determinista); tablas `daily_challenges` y `daily_attempts`
(`drizzle/0003_daily_challenge.sql`); `DailyService` con `GET /api/daily` y
`POST /api/daily/attempts`; `GET /api/groups/:id/leaderboard` filtrando por la
ventana de la temporada; XP diario por posición en el ranking global.

**Fase 3**:

- Tablas `group_messages` y `notifications`
  (`drizzle/0004_chat_notifications.sql`, ya aplicada a `colors_tst`).
  `notifications.pushed_at` se crea vacía y **no la escribe nadie**: es para el
  push del futuro (4.4).
- `ChatService` con `GET /api/groups/:id/messages` en sus dos modos y
  `POST /api/groups/:id/messages`. **Ni el servicio, ni el controlador, ni el
  repositorio miran el estado de la temporada**: la única guarda es
  `GroupService.assertMember`, que comprueba pertenencia y nada más (5.2.1). Hay
  tests que escriben y leen en un grupo terminado, por servicio y por HTTP.
- Paginación por cursor `(created_at, id)`, no por `offset`. Ver el diario.
- Límite de 500 caracteres (recortado antes de medir, `MESSAGE_TOO_LONG`) y
  limitador de 20 mensajes por minuto **por jugador**, en
  `src/middleware/rateLimit.ts`.
- `NotificationService` con `GET /api/notifications` y
  `POST /api/notifications/read`; `GroupService.renew` deja un aviso
  `season_renewed` por cada miembro (paso 2 del 5.6), y `GET /groups` trae el
  contador de no leídos de cada grupo para el punto rojo.
- Como en las fases anteriores, hay un humo manual pasado contra PostgreSQL de
  verdad (paginación por cursor, mensajes del mismo milisegundo, chat vivo tras
  terminar, avisos al renovar sin borrar la conversación y `pushed_at` intacta).

**La API está documentada al día.** `src/docs/openapi.ts` describe las 33
operaciones que monta el router. Se ve en `/api/docs` (Swagger UI) o en
`/openapi.json`.

**Fase 4** (`front-colors`):

- `src/api/types.ts` y `endpoints.ts`: grupos, avisos y la lectura del reto
  diario. `src/api/dev.ts` va aparte a propósito, porque esas rutas no existen
  en producción.
- `src/app/online/index.tsx` rehecho como **menú de cómo jugar**: primero los
  grupos, la fila de partida rápida deshabilitada, los atajos de crear y unirse,
  y perfil/amigos/clasificación en un bloque secundario.
- `src/app/online/groups/index.tsx`: mis grupos, crear y unirse con código. El
  menú entra aquí con `?action=create` o `?action=join`.
- `src/app/online/groups/[id].tsx`: los tres estados del apartado 8 —activo,
  terminado con clasificación congelada y botón de renovar **solo para el
  `owner`**, y el aviso de que el reto no suma si no hay temporada activa—, más
  miembros, código con botón de compartir y salir del grupo. Los avisos del
  grupo se marcan leídos al abrirlo, filtrando por `groupId` para no apagar el
  punto rojo de los demás.
- `src/components/online/DevTimePanel.tsx`: +1 día, +10 días, terminar esta
  temporada y volver al tiempo real. **Devuelve `null` fuera de `__DEV__`.**
- `src/online/groups.ts`: días restantes, etiquetas y orden de la lista, en un
  solo sitio.
- Todas las cadenas nuevas están en `src/i18n/index.ts` en `es`, `en` y `fr`
  (los diccionarios están tipados, así que faltar una clave rompe el typecheck).

**Cómo se ha verificado la Fase 4 sin dispositivo:** `tsc` y `eslint` limpios;
expo-router regenera `.expo/types/router.d.ts` con `/online/groups` y
`/online/groups/[id]`, que es su propio escaneo de rutas; los tipos del front
casan campo a campo con las vistas que devuelve el backend (10 tipos
comprobados); y las 13 llamadas nuevas apuntan a rutas que el backend monta de
verdad.

**Fase 5** (`front-colors`):

- `src/hooks/useDailyChallenge.ts`: carga la jornada, casa cada ronda con su
  dibujo del catálogo local, lleva el bucle de juego y cierra el intento. **No
  elige nada**: los logos y el `colorIndex` llegan del servidor. Exporta además
  `useCountdown`, la cuenta atrás en su propio hook para que el reloj no corra
  durante la partida.
- `src/online/daily.ts`: búsqueda de un logo por `assetId` **sin** el filtro
  `DEV_ONLY_LOGOS`, formato de la cuenta atrás y de la jornada, y qué grupos
  hacen que la puntuación cuente.
- `src/app/online/daily/index.tsx`: la preparación. Cubre los cuatro estados
  del apartado 8 —sin intentos, reto cerrado, cuenta atrás al próximo y sin
  ningún grupo activo (5.3)— y lleva el panel de desarrollo, que aquí sirve
  para cruzar el corte de las 15:00 sin esperarlo.
- `src/app/online/daily/play.tsx`: el tablero (reutilizando `SVGChallenge` y
  `ColorWheel` con las mismas medidas que `app/game.tsx`) y el resultado del
  intento con el desglose por ronda; cada fila abre la `ResultSheet` de siempre
  con los dos colores y la diferencia en HSV.
- `src/api/types.ts` y `endpoints.ts`: los tipos del intento y
  `POST /daily/attempts`, que manda siempre el `challengeId`.
- El menú y la pantalla de grupo enlazan al reto; en el grupo, el botón
  sustituye a la pastilla de «pronto».
- Todas las cadenas nuevas están en `src/i18n/index.ts` en `es`, `en` y `fr`.

**Cómo se ha verificado la Fase 5 sin dispositivo:** `tsc` y `eslint` limpios;
expo-router regenera `.expo/types/router.d.ts` con `/online/daily` y
`/online/daily/play`; los tipos del intento casan campo a campo con
`DailySubmitResult` y `DailyRoundResult` del backend; y un cruce de los dos
catálogos comprueba que **cualquier ronda que el servidor pueda mandar se puede
dibujar**: los 137 identificadores coinciden, tienen el mismo número de colores
a cada lado, todos traen `svgXml` y el `colorIndex` que elige el selector existe
siempre en el catálogo de la app.

**Lo que el backend NO tiene** y queda para más adelante: envío de push real
(solo está la columna `pushed_at`, vacía) y editar o borrar mensajes del chat.

### Diario de decisiones

Apunta aquí lo que se decida sobre la marcha y no esté ya en el plan.

- **2026-08-27 — El no miembro recibe `404 GROUP_NOT_FOUND`, no `403`.** La
  tabla del 5.2 decía `403` pero el criterio de aceptación de la Fase 1 dice
  `GROUP_NOT_FOUND`, y la regla 5 del apartado 6 ("un grupo solo se ve desde
  dentro") pide no delatar que ese identificador existe. Se ha ido por el 404
  para las dos cosas: grupo inexistente y grupo del que no eres miembro. El
  código `NOT_A_MEMBER` queda declarado en `appError.ts` pero sin usar todavía.
- **2026-08-27 — Al salirse el `owner`, la propiedad pasa al miembro más
  antiguo.** El plan no lo decía. Sin dueño nadie podría renovar nunca y el
  grupo quedaría muerto. Si el `owner` era el último, el grupo se queda vacío:
  no se borra nada (3.3).
- **2026-08-27 — Renovar todavía no avisa a nadie.** El paso 2 del 5.6 (una
  fila en `notifications` por miembro) necesita esa tabla, que llega en la Fase
  3. Hay un comentario marcándolo en `GroupService.renew`.
- **2026-08-27 — `groups.created_at` sí usa `defaultNow()`**, porque es
  informativo (lo permite el 5.4). Aun así el servicio le pasa siempre el valor
  del `Clock`; el default es solo la red de seguridad. `group_seasons.starts_at`
  y `ends_at` no tienen default ninguno, a propósito.
- **2026-08-27 (Fase 2) — La jornada se calcula en Node con `Intl`, no en
  PostgreSQL.** El 4.2 decía "el backend no tiene librería de zonas horarias":
  sí la tiene, Node 20 trae ICU completo y `Intl` sabe de los cambios de hora.
  Se ha hecho en `src/game/daily/calendar.ts` para poder escribir los tests de
  cambio de hora sin levantar una base de datos, que es justo lo que pide la
  Fase 2. Para que no haya dos verdades,
  `tests/dailyCalendarPostgres.test.ts` comprueba que el módulo y las dos
  consultas `AT TIME ZONE` del plan dan **exactamente** lo mismo en 484
  instantes alrededor de los dos cambios de hora y en 400 aperturas seguidas;
  ese test se salta solo si no hay base de datos a mano. Lo que no cambia: el
  instante entra siempre como parámetro desde el `Clock`, nunca `now()`.
- **2026-08-27 (Fase 2) — La jornada cierra cuando abre la siguiente, no a las
  24 h.** El esquema del 4.2 ponía `closes_at = opens_at + 24 h`, pero eso es
  justo la trampa del horario de verano: el último domingo de marzo el día dura
  23 horas y el de octubre 25. Con un salto fijo quedaría una hora sin reto en
  octubre y una hora con dos retos abiertos en marzo. Encadenando con la
  apertura del día siguiente las jornadas se tocan exactamente. Hay tests de los
  dos domingos y uno que recorre 400 días sin huecos ni solapes.
- **2026-08-27 (Fase 2) — `POST /daily/attempts` acepta un `challengeId`
  opcional.** El cuerpo del 7 era solo `{ answers }`. Sin el id, el jugador que
  empieza a las 14:55 y envía a las 15:01 vería sus respuestas puntuadas contra
  los logos del reto **nuevo**. Mandándolo, el servidor lo detecta y responde
  `409 DAILY_CLOSED`. Es opcional, así que el contrato del plan sigue valiendo.
- **2026-08-27 (Fase 2) — El XP diario se concede como un único neto por
  jornada, con recargo.** El 3.2 pide "una sola concesión diaria por jugador"
  según la posición en el ranking global, pero esa posición se mueve mientras la
  gente juega y hay dos intentos. Solución: en cada intento se mira lo que le
  correspondería por su posición y se le abona **solo lo que le falte** de lo ya
  cobrado ese día (`daily_attempts.xp_earned`). Así el segundo intento puede
  completar al primero si mejora, nunca duplica, y nunca se quita XP a nadie
  aunque le adelanten después (regla 6.6). Baremo en `game/xp/xp.ts`: 100 / 80 /
  65 los tres primeros y 50 de participación.
- **2026-08-27 (Fase 2) — El reto diario no tiene bonus de velocidad.** Se
  reutiliza `calculateScore` de las partidas en vivo con `durationMs: 0`, así
  que la puntuación es solo la precisión: 1000 por ronda, 5000 el pleno. Un
  cronómetro no encaja en un juego asíncrono en el que cada uno entra cuando
  quiere.
- **2026-08-27 (Fase 2) — Lo jugado antes de crear un grupo no cuenta en su
  temporada 1.** La ventana arranca al crear el grupo, así que un grupo nuevo no
  absorbe retroactivamente las partidas anteriores de sus miembros. Lo destapó
  el humo contra PostgreSQL; hay un test que lo fija.


- **2026-08-27 (Fase 3) — El chat pagina por cursor `(created_at, id)`, no por
  `offset`.** El 7 pedía `?before=<id>`, que ya es un cursor; se ha completado
  con el `id` como desempate. En un chat que crece por abajo mientras lo lees,
  el desplazamiento se descuadra y salen mensajes repetidos o saltados; y sin el
  `id`, dos mensajes escritos en el mismo milisegundo pueden pisarse y uno no
  aparecer nunca. Hay tests de las dos cosas, y el humo contra PostgreSQL
  escribe seis mensajes sin mover el reloj para comprobarlo de verdad.
- **2026-08-27 (Fase 3) — Un cursor de otro grupo se rechaza.** `before` y
  `after` exigen que el mensaje sea de esa conversación; si no, `400`. Sin eso,
  un id ajeno colaría mensajes de otro grupo en la página.
- **2026-08-27 (Fase 3) — El limitador del chat va por jugador, no por IP.** Son
  los 20 mensajes por minuto que sugería el 7, pero con `keyGenerator` sobre
  `req.user.id`: varios compañeros de piso o de oficina comparten IP y no tienen
  por qué compartir el límite. La ruta va detrás de `requireAuth`, así que el
  usuario siempre está. `createTestContext({ rateLimitDisabled: false })` permite
  probarlo.
- **2026-08-27 (Fase 3) — Al renovar se avisa también al `owner`.** El 5.6 dice
  "una fila por cada miembro" y el `owner` es miembro. Es discutible avisar a
  quien acaba de pulsar el botón; si molesta en la Fase 6, se quita filtrando una
  línea en `GroupService.renew`.
- **2026-08-27 (Fase 3) — `GET /groups` trae `unreadCount` por grupo.** El 7 pedía
  "los míos, con estado y avisos sin leer", así que `GroupSummary` (y por tanto
  el detalle) lleva el contador para el punto rojo de cada fila. Los avisos sin
  grupo no cuentan para ninguna.
- **2026-08-27 (Fase 3) — Marcar como leído es idempotente y ajeno a prueba de
  balas.** El repositorio filtra siempre por `userId` y solo toca los que aún no
  estaban leídos, así que mandar el id de un aviso de otro no hace nada y volver
  a marcar no reescribe la hora de lectura.
- **2026-08-27 — `openapi.ts` pasa a ser una función.** Se llamaba
  `openApiDocument` y era una constante; ahora es `buildOpenApiDocument({
  devToolsEnabled })`. El motivo: las rutas de `/api/dev` solo se documentan
  cuando están montadas de verdad. Anunciarlas siempre sería describir rutas que
  en producción dan 404 y, peor, delataría que existen, que es justo lo que el
  5.5 quiere evitar. `createApp` le pasa la misma condición que usa para
  montarlas, así que no pueden desincronizarse.
- **2026-08-27 (Fase 4) — El estado del grupo NO se recalcula en el cliente.**
  Llega en `group.status`, ya derivado por el servidor. El reloj del teléfono
  puede ir descuadrado y, sobre todo, no sabe nada del viaje en el tiempo del
  backend: si la app comparase fechas por su cuenta, el panel de desarrollo
  dejaría de funcionar. Lo único que se calcula en local es cuántos días quedan,
  y solo para pintar una etiqueta (`src/online/groups.ts`).
- **2026-08-27 (Fase 4) — Crear y unirse viven en la lista de grupos, y el menú
  entra con un parámetro.** El apartado 8 pide que las dos acciones estén
  también en el menú principal. En vez de duplicar los formularios, los botones
  del menú navegan a `/online/groups?action=create` o `?action=join` y la
  pantalla abre la pestaña que toca. Un solo formulario que mantener.
- **2026-08-27 (Fase 4) — Los avisos se marcan leídos filtrando por grupo.**
  Al abrir un grupo se piden los no leídos y se marcan **solo los suyos**, no
  todos: entrar en un grupo no debe apagar el punto rojo de los demás.
- **2026-08-27 (Fase 4) — El panel de desarrollo no tiene hooks propios.** La
  guarda `if (!__DEV__) return null` va antes que nada y todo el estado vive en
  un componente interno, así que en producción no hay ni un `useState` que se
  salte la guarda. Aunque alguien lo forzara, las rutas `/api/dev` tampoco
  existen allí.
- **2026-08-27 (Fase 4) — `useSession` expone ahora el `ApiClient` en crudo.**
  Lo necesita `createDevApi`, que no forma parte de la superficie normal de la
  API precisamente porque en producción esas rutas no existen.
- **2026-08-28 (Fase 5) — El reto diario vive en `/online/daily`, no dentro de
  un grupo.** El árbol del apartado 8 lo dibujaba como
  `/online/groups/[id]/play`, pero el 5.3 dice que el reto es global y uno de
  los estados obligatorios es el del jugador **sin ningún grupo activo** —o sin
  ninguno—, que colgando la pantalla de un grupo no tendría por dónde entrar.
  Los grupos y el menú enlazan ahí, y la propia pantalla dice en cuántas
  clasificaciones suma lo que estás jugando.
- **2026-08-28 (Fase 5) — No hay hoja de resultado por ronda.** En el juego
  offline, comprobar abre la `ResultSheet` con el color correcto. Aquí no puede
  ser: el objetivo no llega hasta cerrar el intento (regla 6.2) y sacarlo del
  catálogo local para adelantar la UI sería enseñar la respuesta. Responder una
  ronda solo avanza —con el pulso del logo como confirmación— y el desglose de
  las cinco aparece al final, con lo que devuelve el servidor. Cada fila de ese
  desglose abre la `ResultSheet` de siempre, que es donde vive la comparación de
  los dos colores.
- **2026-08-28 (Fase 5) — Las respuestas viven en una referencia, no en el
  estado.** Responder la última ronda cierra el intento en el mismo gesto, y un
  `setState` no se ve dentro del mismo ciclo: leyendo de la referencia, lo que
  se envía incluye siempre la última respuesta. De regalo, si el envío falla se
  puede reintentar sin volver a jugar las cinco rondas.
- **2026-08-28 (Fase 5) — La cuenta atrás se calla si el reloj del móvil no cae
  dentro de la ventana del reto.** El servidor no dice qué hora tiene, así que
  la cuenta atrás se calcula con el reloj del teléfono. Al cargar se comprueba
  si ese reloj está dentro de `[opensAt, closesAt)`: si no lo está —viaje en el
  tiempo del backend (5.5), o la hora del móvil mal puesta— no se enseña ninguna
  cifra en vez de enseñar una inventada. Quien decide de verdad si la jornada
  cerró sigue siendo el servidor, con su `DAILY_CLOSED`.
- **2026-08-28 (Fase 5) — El catálogo local se consulta sin `DEV_ONLY_LOGOS`.**
  `hooks/useChallenge.ts` filtra el catálogo con esa constante para acotar los
  modos offline mientras se prueba algo. Aplicarla aquí dejaría sin dibujo
  precisamente los logos que el servidor sí ha elegido. La búsqueda por
  `assetId` va aparte, en `online/daily.ts`.
- **2026-08-28 (Fase 5) — Un logo que la app no tenga no bloquea el intento.**
  Si los dos catálogos se desincronizan, esa ronda se pinta como un hueco con su
  `assetId` y se sigue jugando: el servidor exige respuesta para todas las
  rondas, así que quedarse parado costaría el intento entero.
- **2026-08-28 (Fase 5) — El menú pide también `GET /daily`.** La fila del reto
  dice cuántos intentos quedan sin entrar en ella. Va con su propio `catch`: si
  esa llamada falla, la fila se queda con el texto genérico en vez de tumbar el
  menú entero.

- **2026-08-27 — Hay un test que impide que la documentación se vuelva a quedar
  atrás.** `tests/openapi.test.ts` compara la especificación con la lista de
  rutas montadas en las dos direcciones (nada sin documentar, nada documentado
  que no exista), comprueba que no haya `$ref` rotos y que `/api/dev` solo
  aparezca con las herramientas activas. Las fases 1-3 llegaron a estar enteras
  sin documentar; con esto la próxima ruta nueva rompe un test en vez de pasar
  desapercibida. **Si añades una ruta, añádela también a `MOUNTED`.**

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
├─ /online/daily                  el reto de hoy: preparación y estados
│   └─ /online/daily/play            el reto (2 intentos) y su resultado
│
├─ /online/groups                 mis grupos · crear · unirse con código
│   ├─ /online/groups/[id]           reto de hoy + clasificación + miembros + acceso al chat
│   └─ /online/groups/[id]/chat      la conversación
│
└─ Secundario (ya existen, se mantienen)
    ├─ /online/friends
    ├─ /online/leaderboard
    └─ /online/profile
```

Crear y unirse a un grupo deben ser accesibles **también desde el menú
principal**, no solo desde dentro de la lista de grupos.

> El reto colgaba de `/online/groups/[id]/play` en la primera versión de este
> árbol. Se movió a `/online/daily` porque es global (5.3) y hay que poder
> jugarlo sin tener ningún grupo; ver el diario de decisiones.

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

- [x] **Servicio `Clock` (5.4)** inyectado desde `src/container.ts`, con la
      implementación real y la de desarrollo con desfase — `src/services/clock.ts`
- [x] **`SEASON_DURATION_MS` y `DEV_TIME_TRAVEL`** en `src/config/env.ts` y en
      `.env.example`
- [x] **Router `/api/dev`** con los endpoints de tiempo (5.5), montado solo si
      procede — `src/routes/dev.ts`, condicionado en `createApp`
- [x] Tablas `groups`, `group_seasons` y `group_members` + migración
      (`drizzle/0002_groups.sql`)
- [x] Generador de códigos (4.1) con reintento ante colisión — `src/utils/joinCode.ts`
- [x] `GroupRepository` (Drizzle + memoria)
- [x] `GroupService`: crear, unirse por código, listar, detalle, salir, **renovar**
- [x] Estado `activo`/`terminado` derivado (3.4) y **control de acceso del 5.2**
- [x] `POST /api/dev/groups/:id/season/end` para terminar una temporada al vuelo
- [x] Códigos de error nuevos, controlador y rutas
- [x] Tests con repositorios en memoria, al estilo de `tests/friends.test.ts`,
      usando un `Clock` falso para simular el paso de los días — `tests/groups.test.ts`

> Pendiente que arrastra la Fase 3: al renovar falta insertar el aviso
> `season_renewed` por miembro (paso 2 del 5.6). La tabla `notifications` aún no
> existe.

**Aceptación:** dos usuarios, uno crea grupo y el otro entra con el código. Un
tercero sin código recibe `GROUP_NOT_FOUND`. Con la temporada forzada a
terminada, renovar funciona solo para el `owner` y crea la temporada 2; con la
temporada activa devuelve `SEASON_STILL_ACTIVE`.

**Y sobre todo:** con `DEV_TIME_TRAVEL=true`, un `POST /api/dev/time/advance
{ "days": 10 }` debe dejar el grupo en estado `terminado` sin reiniciar el
servidor ni esperar. Con `NODE_ENV=production` esa ruta debe devolver `404`.

### Fase 2 — Backend: reto diario

- [x] Tablas `daily_challenges` y `daily_attempts` + migración
      (`drizzle/0003_daily_challenge.sql`)
- [x] Cálculo de la jornada **alimentado por el `Clock`, nunca por `now()` de
      SQL**, con **tests de cambio de hora** — `src/game/daily/calendar.ts`. Se
      hace con `Intl` en vez de `AT TIME ZONE` y se comprueba que coincide con
      PostgreSQL: ver el diario de decisiones
- [x] Generación bajo demanda con semilla determinista (4.3)
- [x] `GET /daily` y `POST /daily/attempts` con validación de ventana e intentos
- [x] Puntuación **en el servidor** reutilizando `compare.ts` y `score.ts`
- [x] XP diario único por jugador (3.2), reutilizando `game/xp/xp.ts`
- [x] `GET /groups/:id/leaderboard` filtrando por la ventana de la temporada
- [x] `GET /groups/:id/seasons` — ya estaba desde la Fase 1

**Aceptación:** jugar dos intentos, ver que cuenta el mejor y que aparece en la
clasificación. Tras renovar, la clasificación sale a cero **sin que se haya
borrado ningún intento**, y el XP del jugador sigue intacto.

**Con viaje en el tiempo:** avanzar un día debe hacer aparecer un reto nuevo con
otros logos y devolver los dos intentos. Avanzar hasta cruzar el último domingo
de octubre no debe descuadrar la jornada.

### Fase 3 — Backend: chat y avisos

- [x] Tablas `group_messages` y `notifications` (con `pushed_at`, ver 4.4) +
      migración (`drizzle/0004_chat_notifications.sql`)
- [x] `GET /groups/:id/messages` en sus dos modos (`before` y `after`), con
      cursor `(created_at, id)` — ver el diario de decisiones
- [x] `POST /groups/:id/messages` con límite de 500 caracteres y de ritmo
      (20/min por jugador)
- [x] **El chat funciona con la temporada terminada** (regla 5.2.1) — la única
      guarda es `GroupService.assertMember`, que no mira la temporada
- [x] Avisos: creación al renovar, `GET /notifications`, `POST /notifications/read`
- [x] Tests: no miembro rechazado, chat vivo tras terminar, aviso a todos al
      renovar — `tests/chat.test.ts` y `tests/notifications.test.ts`

**Aceptación:** dos miembros conversan; con la temporada terminada el chat
sigue funcionando; renovar deja un aviso sin leer a cada miembro.

### Fase 4 — Frontend: menú y grupos

- [x] Rehacer `src/app/online/index.tsx` como menú de "cómo jugar"
- [x] Fila de partida rápida visible pero deshabilitada
- [x] Tipos y endpoints nuevos en `src/api/types.ts` y `src/api/endpoints.ts`
- [x] `/online/groups`: lista, crear, unirse con código
- [x] `/online/groups/[id]`: miembros, reto de hoy, clasificación con podio
- [x] Estado terminado con podio congelado y botón de renovar solo para el `owner`
- [x] Amigos, ranking y perfil pasan a secundario
- [x] **Panel de desarrollo bajo `__DEV__`** — `src/components/online/DevTimePanel.tsx`,
      en la lista de grupos y dentro de cada grupo (ahí con el atajo de terminar
      **esa** temporada sin mover el reloj global)
- [ ] **Probarlo a mano**: hace falta un dispositivo y dos cuentas de Clerk
      reales. Es el criterio de aceptación y es lo único que queda de esta fase

**Aceptación:** crear un grupo desde la app y que otro dispositivo entre con el
código. Un grupo terminado se ve como tal, y solo su creador ve el botón.

### Fase 5 — Frontend: el reto diario

- [x] `useDailyChallenge`: rondas del servidor, sin selección local —
      `src/hooks/useDailyChallenge.ts`
- [x] Pantalla de preparación (qué toca hoy, intentos restantes) —
      `src/app/online/daily/index.tsx`
- [x] Pantalla de juego reutilizando `SVGChallenge` y `ColorWheel` —
      `src/app/online/daily/play.tsx`
- [x] Envío del intento y resultado con desglose por ronda, con la
      `ResultSheet` de siempre para el detalle de cada una
- [x] Estados: sin intentos, reto cerrado, cuenta atrás, **sin grupo activo**
      (5.3)
- [ ] **Probarlo a mano**: hace falta un dispositivo y una cuenta de Clerk real.
      Es el criterio de aceptación y es lo único que queda de esta fase

**Aceptación:** partida diaria completa desde la app, con la clasificación
actualizándose. Al volver de la partida, la pantalla del grupo relee la
clasificación en su `useFocusEffect`.

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
