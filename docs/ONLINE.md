# Modo online

Cómo la app habla con `back-colors` y por qué el modo online y el offline no se
tocan entre sí.

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

## Mapa de ficheros

| Fichero | Qué hace |
|---|---|
| `src/api/config.ts` | Resuelve la URL del backend |
| `src/api/client.ts` | `fetch` + cabecera Bearer (token de Clerk) + timeout |
| `src/api/endpoints.ts` | Los endpoints agrupados por área |
| `src/api/types.ts` | Espejo de los tipos que devuelve el backend |
| `src/api/errors.ts` | `ApiError` y traducción de códigos a texto |
| `src/online/clerk.ts` | Resuelve la clave publicable de Clerk |
| `src/online/clerkErrors.ts` | Traducción de los códigos de error de Clerk |
| `src/online/session.tsx` | Une la sesión de Clerk con el perfil de juego |
| `src/online/sessionStorage.ts` | Caché del perfil (los tokens los guarda Clerk) |
| `src/components/online/` | Piezas de UI compartidas con la paleta de siempre |
| `src/app/online/` | Las pantallas |

## Pantallas

```
/                     inicio (offline + online)
└─ /online            hub: identidad, XP, puestos y accesos
   ├─ /online/auth        entrar o registrarse
   ├─ /online/profile     perfil, cambiar nombre, cerrar sesión
   ├─ /online/friends     buscar, solicitudes, lista de amigos
   └─ /online/leaderboard ranking mundial y de amigos
```

`app/online/_layout.tsx` hace de guarda: sin sesión solo se puede estar en
`/online/auth`, y con sesión esa pantalla redirige al hub. Se usa `replace` para
que el botón «atrás» no devuelva a un sitio donde el jugador ya no puede estar.

## Endpoints consumidos

Solo REST. Las partidas en tiempo real van por Socket.IO y **todavía no están**:
la tarjeta «Partida online» del hub aparece bloqueada a propósito.

No hay endpoints de alta ni de acceso: de eso se encarga Clerk desde la propia
app. La primera llamada a `GET /api/me` es además la que crea la ficha del
jugador en el backend.

| Método | Ruta | Pantalla |
|---|---|---|
| GET · PATCH | `/api/me` | hub, perfil |
| GET | `/api/users/search` | amigos |
| GET | `/api/friends` | hub, amigos |
| POST | `/api/friends/:id` · `/accept` · `/reject` | amigos |
| DELETE | `/api/friends/:id` | amigos |
| GET | `/api/leaderboards/global` · `/friends` · `/me` | hub, ranking |

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
secreto ahí.

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
con la UI de siempre, en los tres idiomas. Tres pasos: acceder, registrarse y
confirmar el email con un código de 6 dígitos.

Se usa la API «future» de Clerk (`signIn.password()`, `signUp.create()`…), que no
lanza excepciones: cada llamada devuelve `{ error }` y el estado del intento se
lee en `signIn.status` / `signUp.status`. Al completarse, `finalize()` activa la
sesión y la guarda del layout lleva sola al hub.

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

## Textos

Todo pasa por `t()`, en los tres idiomas del proyecto (es, en, fr). Como
`TranslationKey` sale de `keyof typeof es`, si añades una clave al diccionario
español **TypeScript te obliga** a ponerla también en inglés y francés.

Los mensajes de error se eligen por el `code`, nunca por su texto: el backend
contesta en español, Clerk en inglés, y la app está en tres idiomas. Hay dos
mapas, uno por origen: `src/api/errors.ts` (backend) y `src/online/clerkErrors.ts`
(Clerk).
