# Modo online

Cómo la app habla con `back-colors` y por qué el modo online y el offline no se
tocan entre sí.

> Revisión: **2026-09-01** (Fase 7). Describe la app tal y como está: grupos
> privados con reto diario, chat y avisos. El plan de esa tanda vive en
> `docs/GRUPOS-RETO-DIARIO.md`; aquí solo está la arquitectura del cliente.

---

## La frontera entre offline y online

La regla es una sola y está sostenida por la estructura de carpetas, no por
disciplina:

> **`ClerkProvider` y `SessionProvider` se montan en
> `app/online/_layout.tsx`, nunca en el layout raíz.**

(El scaffold por defecto de Clerk pone `ClerkProvider` en la raíz. Aquí no:
haría que abrir la app para jugar sin conexión arrancase su cliente.)

Consecuencias, que es lo que hace que el modo offline siga siendo offline de
verdad:

- Mientras el jugador está en `/`, `/offline`, `/game`, `/party-setup` o
  `/party`, no existe ningún cliente HTTP, no se leen credenciales y no se toca
  la red.
- El árbol offline no importa nada de `src/api/`, de `src/online/` ni de
  `@clerk/expo`. Si alguien lo intentara, el import saltaría a la vista en la
  revisión.
- El perfil cacheado vive en su propio namespace de AsyncStorage
  (`colorquest:v1:online:`), separado del de `utils/storage.ts`. Cerrar sesión lo
  borra; **no toca** récords, rachas ni partidas guardadas.
- Sin backend levantado, el modo offline funciona igual. Solo se rompe `/online`,
  y ahí se enseña un error explicando que no hay conexión.
- Sin clave publicable de Clerk configurada, `/online` enseña un aviso y el resto
  del juego abre con normalidad: la comprobación no revienta al importar.

La única excepción declarada son los componentes de `src/design/` y
`src/components/`: los usan los dos árboles, y por eso ninguno de ellos importa
nada de `src/api/` ni de `src/online/`.

---

## Qué es la parte online, en una frase

Un Wordle competitivo entre amigos: **grupos privados** de hasta donde llegue el
código de invitación, con una **temporada de 10 días**, un **reto diario por
grupo** que abre a las 15:00 (hora de Madrid) y admite dos intentos, una
**clasificación** que se congela al acabar la temporada, y un **chat** que no se
cierra nunca.

Lo que **no** hay, y no se promete en la UI: partidas 1v1 en tiempo real. No hay
Socket.IO en el cliente. El chat va por sondeo.

---

## Pantallas

La parte online es un `Tabs` con cuatro pestañas y varias pantallas colgando de
ellas. La barra la dibuja `components/online/OnlineTabBar.tsx`; las rutas que no
son pestaña se declaran con `href: null`.

```
/                        inicio (offline + online)
└─ /online               ▸ Hoy — el reto de cada grupo, la racha y los atajos
   ├─ /online/groups     ▸ Grupos — los míos, crear y unirse por código
   │  └─ /online/groups/[id]         la ficha del grupo
   │     ├─ /online/groups/[id]/chat   la conversación
   │     └─ /online/groups/[id]/edit   ajustes: nombre, avisos, miembros,
   │                                   código, temporadas y salir
   ├─ /online/leaderboard ▸ Ranking — mundial y de amigos
   ├─ /online/profile     ▸ Perfil — nivel, XP, solicitudes y sesión
   │  └─ /online/friends     buscar, solicitudes y lista
   ├─ /online/auth           entrar o registrarse (fuera de las pestañas)
   └─ /online/daily
      ├─ /online/daily/play  el tablero del reto: rondas, rueda y resultado
      └─ /online/daily       RETIRADA — solo redirige (ver más abajo)
```

`app/online/_layout.tsx` hace de guarda: sin sesión solo se puede estar en
`/online/auth`, y con sesión esa pantalla redirige a la pestaña Hoy. Se usa
`replace` para que el botón «atrás» no devuelva a un sitio donde el jugador ya no
puede estar.

### La ficha del grupo es la pantalla principal

`/online/groups/[id]` reúne todo lo que se hace a diario: el reto de hoy con su
anillo de rondas, los intentos que quedan, la clasificación, la entrada al chat y
—si la temporada terminó— el botón de renovar. Se juega desde aquí.

`/online/daily` era la antesala del reto y **ya no existe como pantalla**:
enseñaba los mismos datos una pantalla más adentro. Hoy solo redirige (con
`?group=` a la ficha de ese grupo, sin él a la lista) y su implementación sigue
comentada dentro del fichero por si hubiera que recuperarla.

### Los tres estados de un grupo

| Estado | Qué se ve |
|---|---|
| **Activo** | Días que quedan, reto de hoy jugable, clasificación en vivo |
| **Terminado** | «Resultado final» congelado, aviso de que el chat sigue abierto, y el botón de renovar **solo para el creador** |
| **Sin intentos hoy** | El bloque de jugar se apaga y dice cuándo abre el siguiente |

El estado **no se calcula en el cliente**: llega en `group.status`, ya derivado
por el servidor. El reloj del teléfono puede ir descuadrado y, sobre todo, no
sabe nada del viaje en el tiempo del backend. Lo único que se calcula en local es
cuántos días quedan, y solo para pintar una etiqueta
(`src/online/groups.ts`).

---

## Mapa de ficheros

### La capa de red

| Fichero | Qué hace |
|---|---|
| `src/api/config.ts` | Resuelve la URL del backend |
| `src/api/client.ts` | `fetch` + cabecera Bearer (token de Clerk) + timeout |
| `src/api/endpoints.ts` | Los endpoints agrupados por área |
| `src/api/types.ts` | Espejo de los tipos que devuelve el backend |
| `src/api/errors.ts` | `ApiError` y traducción de códigos a texto |
| `src/api/dev.ts` | **Aparte a propósito**: las rutas `/api/dev` no existen en producción |

### Sesión y estado compartido

| Fichero | Qué hace |
|---|---|
| `src/online/clerk.ts` | Resuelve la clave publicable de Clerk |
| `src/online/clerkErrors.ts` | Traducción de los códigos de error de Clerk |
| `src/online/session.tsx` | Une la sesión de Clerk con el perfil de juego |
| `src/online/sessionStorage.ts` | Caché del perfil (los tokens los guarda Clerk) |
| `src/online/social.tsx` | Contador de solicitudes de amistad sin responder, para el punto rojo de la pestaña Perfil |

### Reglas de negocio del cliente

Módulos sin JSX y sin red: lo que la UI necesita saber, en un solo sitio.

| Fichero | Qué decide |
|---|---|
| `src/online/groups.ts` | Días que quedan, etiquetas de estado, orden de la lista, fechas de una temporada, normalizar el código, y **apagar el punto rojo de los grupos silenciados** |
| `src/online/daily.ts` | Buscar un logo por `assetId` en el catálogo local, formato de la cuenta atrás y de la jornada |
| `src/online/chat.ts` | Las constantes del contrato (500 caracteres, 5 s de sondeo, 40 mensajes por página) y `buildChatRows`, que convierte la conversación en filas con separadores de día |
| `src/online/friends.ts` | `relationOf`: qué eres de alguien (amigo, pendiente, nada) |

### Lo que se guarda en el teléfono

Ninguna de estas cosas la tiene el backend hoy. Todas caducan solas y todas
fallan en silencio: si el almacenamiento se rompe, se pierde un adorno, no la
pantalla.

| Fichero | Qué guarda | Por qué no está en el servidor |
|---|---|---|
| `src/online/attempts.ts` | El desglose del intento de hoy por grupo (color enviado y acierto de cada ronda) y **el XP ganado hoy** | Las rondas solo viajan una vez, al cerrar el intento; `GET /me` trae el XP total, nunca el del día |
| `src/online/streak.ts` | Las jornadas jugadas seguidas y el historial de dos semanas | El backend no lleva racha. `playedDays` es por grupo y por temporada, que no es lo mismo |
| `src/online/chatSeen.ts` | Hasta qué mensaje has leído en cada grupo | El backend cuenta avisos, pero de mensajes no lleva registro de lectura |
| `src/online/dailyCache.ts` | El último estado conocido del reto de cada grupo | Para que la tarjeta salga llena al instante: la primera visita del día **crea** el reto y tarda |
| `src/utils/storage.ts` | Si un grupo tiene los avisos encendidos | No hay push todavía, así que el servidor no tiene ninguna decisión que tomar con esto |

### Hooks y piezas de UI propias del online

| Fichero | Qué hace |
|---|---|
| `src/hooks/useDailyChallenge.ts` | Carga la jornada, casa cada ronda con su dibujo, lleva el bucle de juego y cierra el intento. Exporta también `useCountdown` |
| `src/hooks/useGroupChat.ts` | Carga, sondeo y envío de la conversación |
| `src/components/online/OnlineTabBar.tsx` | La barra de cuatro pestañas |
| `src/components/online/UnreadDot.tsx` | El punto rojo, con cifra a partir de dos |
| `src/components/online/StreakRibbon.tsx` | El calendario de dos semanas de la racha |
| `src/components/online/ChallengeWall.tsx` | El muro de logos del menú |
| `src/components/online/DevTimePanel.tsx` | Viaje en el tiempo. **Devuelve `null` fuera de `__DEV__`** |

---

## Endpoints consumidos

Solo REST, y **ningún socket**: el chat va por sondeo (`after=`), no por
WebSocket. Las partidas en tiempo real no están construidas y la app no las
anuncia.

No hay endpoints de alta ni de acceso: de eso se encarga Clerk desde la propia
app. La primera llamada a `GET /api/me` es además la que crea la ficha del
jugador en el backend.

| Método | Ruta | Dónde se usa |
|---|---|---|
| GET · PATCH | `/api/me` | Perfil, y en cada foco del menú y del perfil |
| GET | `/api/users/search` | Amigos |
| GET | `/api/friends` | Perfil, amigos, ficha de grupo, ajustes del grupo |
| POST | `/api/friends/:id` · `/accept` · `/reject` | Amigos, perfil, clasificación del grupo |
| DELETE | `/api/friends/:id` | Amigos |
| GET · POST | `/api/groups` | Lista de grupos, menú, crear |
| POST | `/api/groups/join` | Unirse con el código |
| GET · PATCH | `/api/groups/:id` | Ficha del grupo, ajustes |
| GET | `/api/groups/:id/seasons` | Historial de temporadas (ajustes del grupo) |
| GET | `/api/groups/:id/leaderboard` | Clasificación, viva o congelada |
| POST | `/api/groups/:id/renew` | Renovar. Solo el creador, solo con la temporada terminada |
| DELETE | `/api/groups/:id/members/me` | Salir del grupo |
| GET · POST | `/api/groups/:id/messages` | Chat: historial (`before=`), sondeo (`after=`) y envío |
| GET | `/api/daily` | El menú: en qué grupos queda algo por jugar hoy |
| GET | `/api/groups/:id/daily` | El reto de un grupo. **La primera visita del día lo crea** |
| POST | `/api/groups/:id/daily/attempts` | Cerrar un intento |
| GET · POST | `/api/notifications` · `/read` | El punto rojo, y marcarlo leído al abrir el grupo |
| GET | `/api/leaderboards/global` · `/friends` · `/me` | Ranking |
| POST | `/api/dev/time/*` · `/api/dev/groups/:id/season/end` | Solo `__DEV__`, y solo si el backend las monta |

### Reglas que el cliente respeta

1. **La puntuación la calcula el servidor.** La app manda los colores elegidos en
   HSV; el backend recalcula. Nunca al revés.
2. **El color objetivo no se pide antes de tiempo.** Llega en la respuesta del
   intento, y hasta entonces la app no lo saca del catálogo local aunque lo
   tenga delante.
3. **El estado de la temporada lo decide el servidor.** El cliente no compara
   fechas para eso.
4. **El chat no se bloquea nunca** por el estado de la temporada. Ni el hook ni
   la pantalla miran `group.status` para decidir si funcionan.

---

## El chat, por sondeo

- Una cadena de `setTimeout` cada 5 s, no un `setInterval`: así una petición
  lenta no se solapa con la siguiente.
- **Solo corre con la pantalla enfocada Y la app en primer plano.** `useFocusEffect`
  cubre navegar a otro sitio, pero no bloquear el móvil: sin escuchar también
  `AppState`, un chat abierto en el bolsillo pediría 720 veces por hora y se
  comería el limitador del servidor.
- Los cursores que se mandan salen **siempre** de la lista confirmada por el
  servidor, nunca de un mensaje pendiente de enviar, que lleva un id temporal.
- Lo que se está enviando vive en un `outbox` aparte para que se quede abajo, que
  es donde se escribe, en vez de flotar hacia arriba con los mensajes que llegan.

---

## Avisos y el punto rojo

El backend crea un aviso (`notifications`) por miembro cada vez que se renueva
una temporada. La app los usa así:

- `GET /groups` trae `unreadCount` por grupo: es lo que enciende el punto rojo en
  la lista y en el menú.
- Al abrir un grupo se marcan leídos **filtrando por ese grupo**, no con «marcar
  todo»: entrar en uno no debe apagar el punto de los demás.
- La ficha del grupo enseña de qué iba el aviso en una línea. Renovar marca leído
  su propio aviso sin enseñar la línea: quien pulsa el botón ya sabe qué ha
  hecho.
- **Los avisos de un grupo se pueden silenciar** desde sus ajustes. Es una
  preferencia local, y lo que apaga es el punto rojo: los avisos se siguen
  creando y se siguen leyendo al entrar.
- El punto rojo significa lo mismo en los tres sitios donde sale —lista de
  grupos, entrada al chat y pestaña Perfil—: «hay algo que no has visto».

No hay push. La columna `pushed_at` del backend existe y está vacía a propósito.

---

## XP y nivel

El XP lo concede el servidor al cerrar un intento, según el puesto en el ranking
de ese reto, y **una sola vez al día por reto**: un segundo intento solo abona lo
que falte, nunca duplica. Como hay un reto por grupo, quien juega en tres grupos
cobra en los tres.

En la app:

- `DailySubmitResult` trae `xpEarned`, `xpTotal`, `level` y `position`. La
  pantalla del resultado enseña lo ganado y, **solo si has subido**, el nivel
  nuevo. Para saberlo, el hook guarda el nivel de antes de enviar: el perfil de
  la sesión se refresca en cuanto vuelve la respuesta, así que compararlo con él
  diría siempre que no.
- El perfil relee `GET /me` al recuperar el foco y suma la línea de hoy: cuánto
  XP ha dado el reto y la racha. El XP del día sale del teléfono
  (`online/attempts.ts`), porque `GET /me` solo trae el total acumulado.
- **Renovar una temporada no toca el XP ni el nivel de nadie.** La clasificación
  del grupo se reinicia porque se filtra por la ventana de la temporada; el
  progreso personal es intocable.

---

## Configurar la URL del backend

Se resuelve una vez, por este orden:

1. `EXPO_PUBLIC_API_URL` (variable de entorno).
2. `expo.extra.apiUrl` de `app.json`.
3. **La IP del propio servidor de Metro**, con el puerto 4000.
4. `http://localhost:4000`.

El punto 3 es el que evita el error clásico: en un móvil físico, `localhost` es
el teléfono, no tu PC. Como Expo ya te está sirviendo la app por la IP de red
local, se reutiliza esa misma IP para la API. En desarrollo, por tanto, **no
tienes que configurar nada**: arranca el backend con `npm run dev` y ya está.

Para producción, define la URL:

```bash
EXPO_PUBLIC_API_URL=https://api.tudominio.com
```

Ojo: las variables `EXPO_PUBLIC_` se incrustan en el bundle. Nunca metas un
secreto ahí, y reinicia Metro con `npx expo start -c` después de tocarlas.

---

## Cuenta y sesión (Clerk)

La identidad la lleva **Clerk**; el backend solo verifica el token que le llega y
guarda el perfil de juego (nombre, XP, nivel, amigos).

### Configuración

`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` en `.env.local` —la escribe `clerk env pull`—
o `expo.extra.clerkPublishableKey` en `app.json`. La clave **secreta** no se pone
aquí nunca: va en el backend.

Para que funcione hacen falta dos cosas en el panel de Clerk:

1. La **Native API** habilitada (`dashboard.clerk.com` → Native Applications).
2. Google y Apple activados en *SSO Connections*, si se quieren esos botones.

### Alta y acceso

`app/online/auth.tsx` usa los hooks de Clerk (`useSignIn`, `useSignUp`, `useSSO`)
con la UI de siempre, en los cuatro idiomas. Tres pasos: acceder, registrarse y
confirmar el email con un código de 6 dígitos.

Se usa la API «future» de Clerk (`signIn.password()`, `signUp.create()`…), que no
lanza excepciones: cada llamada devuelve `{ error }` y el estado del intento se
lee en `signIn.status` / `signUp.status`. Al completarse, `finalize()` activa la
sesión y la guarda del layout lleva sola al menú.

**El nombre de jugador no es una credencial de Clerk.** Se recoge en el alta y
viaja en `unsafeMetadata`; el backend lo adopta al crear la ficha y a partir de
ahí es suyo, editable desde el perfil sin tocar la cuenta. Por eso el acceso es
**por email**, no por nombre de usuario.

### Tokens

- Los guarda Clerk en su `tokenCache`, respaldado por `expo-secure-store`
  (Keychain en iOS, EncryptedSharedPreferences en Android). La app no los toca.
- `ApiClient` pide uno a `clerk.session.getToken()` antes de cada petición; Clerk
  lo renueva solo cuando caduca.
- Ante un 401, se reintenta **una vez** con `getToken({ skipCache: true })`. Si el
  segundo intento también da 401, se cierra la sesión y la guarda devuelve a
  `/online/auth`.
- Al entrar se pinta el perfil cacheado y se refresca contra `/api/me` en segundo
  plano. Si no hay red, se sigue con el cacheado: es mejor que echar al jugador
  porque el servidor esté un momento caído. El caché está etiquetado con el id de
  Clerk de su dueño, para no enseñar el perfil de la cuenta anterior tras
  cambiar de usuario.

---

## Probar el ciclo de una temporada sin esperar 10 días

Con `DEV_TIME_TRAVEL=true` en el backend, `components/online/DevTimePanel.tsx`
sale bajo `__DEV__` en la lista de grupos y en la ficha de cada grupo, con cuatro
botones: **+1 día**, **+10 días**, **terminar esta temporada** y **volver al
tiempo real**.

Dos avisos:

- El panel **devuelve `null` fuera de `__DEV__`**, así que en producción no hay
  ni un `useState` que se salte la guarda. Y aunque alguien lo forzara, el
  backend no monta esas rutas: dan 404.
- **El desfase se pierde al reiniciar el backend.** Si estás probando y reinicias
  `npm run dev`, vuelves al tiempo real y parecerá que el grupo ha resucitado.

Para el ciclo entero hacen falta **dos cuentas de Clerk reales**; las fichas del
seed (`alice`, `bob`…) no sirven para iniciar sesión.

---

## Textos

Todo pasa por `t()`, en los **cuatro idiomas del proyecto: es, en, fr y ca**. El
español es la fuente de verdad. Como `TranslationKey` sale de `keyof typeof es`,
si añades una clave al diccionario español **TypeScript te obliga** a ponerla
también en los otros tres.

El idioma se detecta del dispositivo (`expo-localization`) y se cae al español si
no está entre los cuatro. No hay selector de idioma en la app.

Los mensajes de error se eligen por el `code`, nunca por su texto: el backend
contesta en español, Clerk en inglés, y la app está en cuatro idiomas. Hay dos
mapas, uno por origen: `src/api/errors.ts` (backend) y `src/online/clerkErrors.ts`
(Clerk).
