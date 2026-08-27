# Empezar aquí — contexto para la IA

> **Este fichero es un índice, no un manual.** Su trabajo es decirte qué leer,
> en qué orden y qué ignorar. El contenido real vive en los documentos a los que
> apunta: duplicarlo aquí crearía dos fuentes de verdad que acabarían
> contradiciéndose.
>
> Las rutas llevan prefijo de repositorio (`back-colors/...`,
> `front-colors/...`) porque el trabajo actual toca los dos.

---

## 1. Qué se está construyendo ahora

**Grupos privados con reto diario y chat.** Plan completo en
**`docs/GRUPOS-RETO-DIARIO.md`** — ese es el documento principal.

En una frase: un Wordle competitivo entre amigos. Un mismo reto para todos cada
día a las 15:00, dos intentos, clasificación privada por grupo durante 10 días,
y un chat de grupo.

Pasados los 10 días el grupo **se desactiva para competir pero el chat sigue
vivo**, y solo el creador puede renovar la temporada. El control de acceso de
todo esto está en el **apartado 5 del plan**: léelo antes de escribir cualquier
endpoint de grupo.

**El grueso del trabajo es de backend**: no existe nada de grupos, retos
diarios, temporadas, chat ni avisos en `back-colors`.

### Lo que NO se construye ahora

Partidas rápidas 1v1 contra desconocidos, retar a un amigo, y partidas en tiempo
real de más de dos jugadores. Están decididas a nivel de producto pero
**aparcadas**. No las implementes ni las prometas en la UI más allá de una fila
deshabilitada.

---

## 2. Reglas que no se negocian

Las tres primeras viven en ficheros diminutos que es fácil no abrir; por eso se
repiten aquí.

1. **Expo ha cambiado.** Consulta la documentación versionada exacta en
   <https://docs.expo.dev/versions/v57.0.0/> antes de escribir código de
   cliente. Lo dice `front-colors/AGENTS.md` y va en serio.
2. **La frontera offline/online no se toca.** `ClerkProvider` y
   `SessionProvider` se montan **solo** en
   `front-colors/src/app/online/_layout.tsx`. El árbol offline (`/`,
   `/offline`, `/game`, `/party*`) no importa nada de `src/api/` ni
   `src/online/`. Razonado en `docs/ONLINE.md`.
3. **Tres idiomas siempre.** Toda cadena visible va a
   `front-colors/src/i18n/index.ts` en `es`, `en` y `fr`.
4. **La puntuación la calcula el servidor.** El cliente manda los colores
   elegidos; el backend recalcula. Nunca al revés.
5. **Una sola fuente de la hora.** Toda la lógica de fechas del backend pasa por
   el servicio `Clock`: nada de `Date.now()` suelto ni de `now()` de SQL. Es lo
   que permite viajar en el tiempo para probar el ciclo de 10 días sin
   esperarlos. Apartado 5.4 del plan.
6. **El backend corre como una sola instancia.** Decisión consciente de la V1.

---

## 3. Qué dar de contexto en cada fase

Las fases están en `docs/GRUPOS-RETO-DIARIO.md`, apartado 8.

### Siempre, en cualquier fase

- `front-colors/docs/00-EMPEZAR-AQUI.md` (este fichero)
- `front-colors/docs/GRUPOS-RETO-DIARIO.md` (el plan)

### Fases 1, 2 y 3 — backend

| Fichero | Por qué |
|---|---|
| `back-colors/src/db/schema.ts` | Dónde se añaden las tablas y el estilo de las existentes |
| `back-colors/src/repositories/types.ts` | Los contratos de repositorio |
| `back-colors/src/repositories/drizzle/friendshipRepository.ts` | **Un solo** repositorio como plantilla. No hace falta leerlos todos |
| `back-colors/src/repositories/memory/index.ts` | El doble en memoria que usan los tests |
| `back-colors/src/services/friendService.ts` | Plantilla de servicio con reglas de negocio |
| `back-colors/src/controllers/friendController.ts` | Plantilla de controlador |
| `back-colors/src/routes/index.ts` | Dónde se cuelgan las rutas |
| `back-colors/src/schemas/index.ts` | Validación con Zod |
| `back-colors/src/errors/appError.ts` | Añadir los códigos nuevos |
| `back-colors/src/container.ts` | Cableado de dependencias |
| `back-colors/tests/friends.test.ts` + `tests/helpers.ts` | Cómo se prueban las cosas aquí |

Solo en la Fase 2, además:

| Fichero | Por qué |
|---|---|
| `back-colors/src/game/assets/selector.ts` + `assets/catalog.ts` | Elegir los logos del día |
| `back-colors/src/game/colors/compare.ts` | Comparación de colores |
| `back-colors/src/game/scoring/score.ts` | Puntuación |
| `back-colors/src/game/xp/xp.ts` | XP y niveles |

Solo en la Fase 3 (chat y avisos), además:

| Fichero | Por qué |
|---|---|
| `back-colors/src/middleware/rateLimit.ts` | Montar el limitador de mensajes |
| `back-colors/src/utils/pagination.ts` | Estilo de paginación de la casa |

### Fases 4, 5 y 6 — frontend

| Fichero | Por qué |
|---|---|
| `front-colors/src/api/types.ts`, `client.ts`, `endpoints.ts`, `config.ts` | Dónde se añaden los tipos y las llamadas |
| `front-colors/src/online/session.tsx` | Sesión y cliente autenticado |
| `front-colors/src/app/online/index.tsx` | El hub que hay que rehacer como menú |
| `front-colors/src/app/online/friends.tsx` | Plantilla de pantalla online con listas y acciones |
| `front-colors/src/design/` (`Layout`, `Button`, `Feedback`, `Form`, `tokens`) | Sistema de diseño |

Solo en la Fase 5 (reto diario), además:

| Fichero | Por qué |
|---|---|
| `front-colors/src/app/game.tsx` | **Referencia visual** del bucle de juego |
| `front-colors/src/components/SVGChallenge.tsx` | Render del logo; acepta `editableColorIndex` |
| `front-colors/src/components/ColorWheel.tsx` | Selector de color |
| `front-colors/src/components/ResultSheet.tsx` | Hoja de resultado |
| `front-colors/src/hooks/useChallenge.ts` | Qué **no** reutilizar y por qué |

Solo en la Fase 6 (chat y avisos), además:

| Fichero | Por qué |
|---|---|
| `front-colors/src/design/Form.tsx` | El campo de texto del chat |
| `front-colors/src/design/Avatar.tsx` | Autor de cada mensaje |

### Fase 7

`front-colors/src/i18n/index.ts` y `front-colors/docs/ONLINE.md`.

---

## 4. Qué NO dar de contexto

Esto es tan importante como lo anterior: mete ruido y gasta cuota.

| No leer | Por qué |
|---|---|
| **`docs/PARTIDAS-ONLINE.md`** | **Aparcado.** Describe partidas 1v1 en tiempo real por WebSocket, que aquí no hacen falta. Si se contradice con `GRUPOS-RETO-DIARIO.md`, manda el segundo |
| `back-colors/src/websocket/` | El reto diario es **asíncrono**. No hay WebSocket en este trabajo |
| `back-colors/src/game/engine/` | Motor de partidas en tiempo real. No interviene |
| `back-colors/src/game/modes/` | Modos de partida en vivo (`classic_1v1`). No interviene |
| `back-colors/README.md` (32 KB) | Buenísimo, pero describe sobre todo lo de tiempo real. Ábrelo solo si necesitas un detalle concreto del backend |
| `docs/ROADMAP.md`, apartado 1 | Diseño del multijugador de antes de que existiera el backend. Superado |
| `front-colors/generated/challenges.json` (1,4 MB) | Nunca lo abras entero. Consúltalo con un script de Node |
| `front-colors/src/app/party*.tsx`, `src/utils/party.ts` | Multijugador offline pasándose el móvil. Nada que ver |

---

## 5. Trampas del entorno

- **`DEV_ONLY_LOGOS` está puesto a `["fanta"]`** en
  `front-colors/src/hooks/useChallenge.ts:28` (en git es `null`). Restringe el
  catálogo entero a fanta y deja los modos de un color sin retos. **Es
  deliberado: no lo revierta nadie sin preguntar.**
- **`fanta` tiene `editableColorIndex: 3` con solo 3 colores.** El backend lo
  recorta a 0; el dato del front sigue mal. Detalle en
  `GRUPOS-RETO-DIARIO.md` § 9.
- **Para probar hacen falta dos procesos**: `npm run dev` en `back-colors`
  (puerto 4000) y `npx expo start` en `front-colors` (8081).
- **Y dos cuentas de Clerk reales.** Las fichas del seed (`alice`, `bob`...) no
  sirven para iniciar sesión.
- **Las variables `EXPO_PUBLIC_*` se incrustan en el bundle.** Tras tocar
  `.env`, reinicia Metro con `npx expo start -c`.
- **La base de datos es `colors_tst` en local.** `npm run db:migrate` aplica
  migraciones nuevas; `npm run db:query -- "SELECT ..."` inspecciona sin psql.
- **No esperes 10 días para probar las temporadas.** Con `DEV_TIME_TRAVEL=true`
  hay endpoints para adelantar el reloj, saltar a una fecha o terminar la
  temporada de un grupo al vuelo, y un panel en la app bajo `__DEV__`. Está en
  el apartado 5.5 del plan. También se puede bajar `SEASON_DURATION_MS` a unos
  minutos. Si reinicias el backend, el desfase se pierde y vuelves al tiempo
  real.

---

## 6. Orden de las fases

```
Fase 1  Backend: grupos y temporadas -> crear, unirse, renovar, control de acceso
Fase 2  Backend: reto diario         -> 2 intentos, mejor puntuación, ranking
Fase 3  Backend: chat y avisos       -> conversación y aviso de renovación
Fase 4  Front: menú y grupos         -> crear y unirse desde la app
Fase 5  Front: reto diario           -> partida diaria jugable
Fase 6  Front: chat y avisos         -> conversación y punto rojo
Fase 7  Remates                      -> i18n, XP en perfil, fin de temporada
```

Las fases 1, 2 y 3 son de backend puro y se verifican con tests y `curl`, sin
tocar la app. No empieces la 4 sin tener backend que consumir: la pantalla no se
puede probar de verdad contra nada.

La Fase 3 (chat) es independiente de la 2 (reto diario): si te conviene, se
pueden hacer en el orden contrario.

**Antes de nada, mira el apartado 0 de `docs/GRUPOS-RETO-DIARIO.md`**: ahí está
por qué fase va el trabajo y el diario de decisiones. **Y actualízalo antes de
cerrar la sesión**, o la siguiente empezará a ciegas.

---

## 7. Mapa de documentos

| Documento | Para qué sirve |
|---|---|
| `docs/00-EMPEZAR-AQUI.md` | Este índice |
| `docs/GRUPOS-RETO-DIARIO.md` | **El plan activo.** Modelo de datos, API, pantallas, fases, trampas |
| `docs/PROMPT-IA.md` | Prompts listos para copiar y pegar, uno por fase |
| `docs/ONLINE.md` | Arquitectura del online ya existente y el porqué de la frontera offline/online |
| `docs/PARTIDAS-ONLINE.md` | **Aparcado.** Partidas 1v1 en tiempo real, para más adelante |
| `docs/ROADMAP.md` | Ideas de producto. El apartado 1 está superado |
| `docs/todo.txt` | Pendientes del juego offline, sin relación |
| `AGENTS.md` / `CLAUDE.md` | La regla de la versión de Expo |
| `back-colors/README.md` | Referencia del backend. Sobre todo de la parte en tiempo real |
