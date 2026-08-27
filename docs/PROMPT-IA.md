# Prompts listos para copiar

Uno por fase. Copia el bloque entero, pégalo y ya está: cada prompt le dice a la
IA qué leer, qué no leer y cuándo parar.

**Antes de pegar nada**, comprueba en `docs/GRUPOS-RETO-DIARIO.md` § 0 por qué
fase va el trabajo.

**Desde dónde abrir la sesión:** las fases 1, 2 y 3 son de backend, así que abre
la sesión en `back-colors`. Las fases 4 a 7 son de frontend: ábrela en
`front-colors`. Si la abres en el otro repositorio, ajusta los `../`.

---

## Prompt genérico (si no sabes por dónde vas)

```
Lee front-colors/docs/00-EMPEZAR-AQUI.md y sigue lo que diga.

Mira el apartado 0 de front-colors/docs/GRUPOS-RETO-DIARIO.md para ver por qué
fase va el trabajo, y haz la siguiente fase pendiente.

No implementes nada que el plan marque como aparcado. Al terminar, actualiza el
apartado 0 con lo que has hecho y con cualquier decisión que hayas tomado sobre
la marcha.
```

---

## Fase 1 — Backend: grupos y temporadas

```
Vamos a implementar la Fase 1 (grupos y temporadas) de las partidas online.

CONTEXTO OBLIGATORIO, léelo antes de escribir código:
- ../front-colors/docs/00-EMPEZAR-AQUI.md
- ../front-colors/docs/GRUPOS-RETO-DIARIO.md  (apartados 3, 4, 5, 6, 7 y 9)
- src/db/schema.ts
- src/repositories/types.ts
- src/repositories/drizzle/friendshipRepository.ts   (plantilla, no lo cambies)
- src/repositories/memory/index.ts
- src/services/friendService.ts                      (plantilla)
- src/controllers/friendController.ts                (plantilla)
- src/routes/index.ts
- src/schemas/index.ts
- src/errors/appError.ts
- src/container.ts
- tests/helpers.ts y tests/friends.test.ts

NO LEAS: src/websocket/, src/game/engine/, src/game/modes/, README.md, ni
front-colors/docs/PARTIDAS-ONLINE.md (está aparcado).

QUÉ HACER: las casillas de la Fase 1 del apartado 9. El servicio Clock, las
variables de entorno y el router /api/dev, más las tablas groups, group_seasons
y group_members con su migración, generación de códigos de invitación,
repositorio (Drizzle y memoria), servicio con crear/unirse/listar/detalle/
salir/renovar, controlador, rutas, códigos de error y tests.

EMPIEZA POR EL RELOJ (apartado 5.4). Todo lo demás depende de él:
- Un servicio Clock inyectado, única fuente de la hora.
- PROHIBIDO Date.now() suelto, now() de SQL en consultas de dominio, y
  defaultNow() en columnas que le importen al dominio.
- Sin esto no se puede probar el ciclo de 10 días ni escribir los tests de
  cambio de horario. No lo dejes para el final.

Y AÑADE LAS HERRAMIENTAS DE PRUEBA (apartado 5.5): SEASON_DURATION_MS
configurable y el router /api/dev con advance/set/reset y el atajo para terminar
la temporada de un grupo. Es lo que evita tener que esperar 10 días reales.
El router NO se monta si NODE_ENV es production o si DEV_TIME_TRAVEL no es true:
en producción esas rutas deben dar 404, no 403.

LEE CON ESPECIAL ATENCIÓN EL APARTADO 5 (ciclo de vida y control de acceso).
Es la parte más fácil de hacer mal:
- El estado activo/terminado se DERIVA comparando la hora del Clock con el fin
  de la temporada actual. No lo guardes en un campo ni montes un cron.
- Renovar es solo del owner y solo con la temporada ya terminada; si está
  activa, devuelve SEASON_STILL_ACTIVE.
- Renovar NO borra nada: inserta una temporada nueva y ya. La clasificación se
  reinicia sola porque se filtra por la ventana. Si te ves escribiendo un
  DELETE, párate y relee el apartado 3.3.
- El XP y el nivel individuales no se tocan jamás.

NO HAGAS: nada del reto diario (Fase 2), ni del chat o los avisos (Fase 3), ni
tocar el frontend.

TERMINA CUANDO: `npm test` pase y se cumpla el criterio de aceptación de la
Fase 1, incluido que un POST /api/dev/time/advance {"days":10} deje el grupo
terminado sin reiniciar el servidor. Luego actualiza el apartado 0 del plan.
```

---

## Fase 2 — Backend: reto diario

```
Vamos a implementar la Fase 2 (reto diario). La Fase 1 (grupos y temporadas) ya
está hecha.

CONTEXTO OBLIGATORIO:
- ../front-colors/docs/00-EMPEZAR-AQUI.md
- ../front-colors/docs/GRUPOS-RETO-DIARIO.md  (apartados 3, 4, 5, 6, 7 y 9)
- src/db/schema.ts  (con las tablas de grupos ya dentro)
- lo que escribiste en la Fase 1
- src/game/assets/selector.ts y src/game/assets/catalog.ts
- src/game/colors/compare.ts
- src/game/scoring/score.ts
- src/game/xp/xp.ts
- src/routes/index.ts, src/schemas/index.ts, src/errors/appError.ts
- tests/helpers.ts

NO LEAS: src/websocket/, src/game/engine/, src/game/modes/, ni
front-colors/docs/PARTIDAS-ONLINE.md.

QUÉ HACER: las casillas de la Fase 2 del apartado 9. Tablas daily_challenges y
daily_attempts, cálculo de la jornada, generación del reto bajo demanda, los dos
endpoints de /daily, el ranking del grupo filtrado por la ventana de la
temporada, el historial de temporadas y el XP.

CUIDADO CON:
- El corte de las 15:00 es en Europe/Madrid y hay horario de verano. Usa
  PostgreSQL con AT TIME ZONE (apartado 4.2), pero PASÁNDOLE EL INSTANTE COMO
  PARÁMETRO desde el Clock de la Fase 1, nunca now() de SQL: si se cuela un
  now(), el viaje en el tiempo funcionará a medias y será un infierno de
  depurar. Escribe tests que crucen el último domingo de marzo y el de octubre.
- La puntuación la calcula SIEMPRE el servidor (regla 6.1).
- Máximo 2 intentos por jugador y jornada, y ninguno fuera de ventana.
- El XP se concede una sola vez al día por jugador (apartado 3.2).
- /daily NO depende del grupo y no se bloquea aunque las temporadas hayan
  terminado (apartado 5.3).

NO HAGAS: chat, avisos ni frontend.

TERMINA CUANDO: `npm test` pase, incluidos los tests de cambio de hora, y se
cumpla el criterio de aceptación de la Fase 2 — en particular que tras renovar
la clasificación salga a cero SIN haber borrado ningún intento. Actualiza el
apartado 0.
```

---

## Fase 3 — Backend: chat y avisos

```
Vamos a implementar la Fase 3 (chat de grupo y avisos). Las Fases 1 y 2 ya están
hechas.

CONTEXTO OBLIGATORIO:
- ../front-colors/docs/00-EMPEZAR-AQUI.md
- ../front-colors/docs/GRUPOS-RETO-DIARIO.md  (apartados 4, 5, 6, 7 y 9)
- src/db/schema.ts
- lo que escribiste en la Fase 1 (servicio y repositorio de grupos)
- src/middleware/rateLimit.ts
- src/utils/pagination.ts
- src/routes/index.ts, src/schemas/index.ts, src/errors/appError.ts
- tests/helpers.ts y tests/friends.test.ts

NO LEAS: src/websocket/ (el chat va por sondeo, NO por Socket.IO),
src/game/engine/, src/game/modes/, ni front-colors/docs/PARTIDAS-ONLINE.md.

QUÉ HACER: las casillas de la Fase 3 del apartado 9. Tablas group_messages y
notifications, los endpoints de mensajes en sus dos modos (before para el
historial, after para el sondeo), el envío con límite de 500 caracteres y de
ritmo, y los avisos con su creación al renovar.

CUIDADO CON:
- EL CHAT NO SE BLOQUEA NUNCA POR EL ESTADO DE LA TEMPORADA. Un grupo terminado
  sigue siendo un sitio donde hablar. Es el error más fácil de cometer: poner
  una guarda genérica de "grupo activo" en todos los endpoints del grupo. Ver
  apartado 5.2.
- Lo que sí se comprueba siempre es la pertenencia al grupo.
- La columna pushed_at se crea vacía y NO se usa: es para el push del futuro
  (apartado 4.4). No implementes envío de notificaciones push.

TERMINA CUANDO: `npm test` pase y se cumpla el criterio de aceptación de la
Fase 3. Actualiza el apartado 0.
```

---

## Fase 4 — Frontend: menú y grupos

```
Vamos a implementar la Fase 4 (menú y pantallas de grupos). El backend de las
Fases 1, 2 y 3 ya está terminado y funcionando.

CONTEXTO OBLIGATORIO:
- docs/00-EMPEZAR-AQUI.md
- docs/GRUPOS-RETO-DIARIO.md  (apartados 5, 6, 7, 8 y 9)
- docs/ONLINE.md
- AGENTS.md
- src/api/config.ts, client.ts, types.ts, endpoints.ts
- src/online/session.tsx
- src/app/online/index.tsx    (el hub que hay que rehacer)
- src/app/online/friends.tsx  (plantilla de pantalla online)
- src/design/Layout.tsx, Button.tsx, Feedback.tsx, Form.tsx, tokens.ts
- src/i18n/index.ts           (solo la sección "online.*")

NO LEAS: docs/PARTIDAS-ONLINE.md (aparcado), src/app/party*.tsx,
src/utils/party.ts, ni generated/challenges.json.

QUÉ HACER: las casillas de la Fase 4 del apartado 9. Rehacer el hub como menú de
"cómo quieres jugar", lista de grupos, crear, unirse por código, y detalle de
grupo con miembros y clasificación.

RESPETA:
- La estructura de navegación del apartado 8.
- Los estados de la UI del apartado 8: grupo activo, grupo terminado con podio
  congelado y botón de renovar SOLO para el owner, y sin ningún grupo activo.
- La fila de "partida rápida" se pinta DESHABILITADA. No la implementes.
- Amigos, ranking y perfil pasan a secundario pero siguen accesibles.
- Añade el PANEL DE DESARROLLO bajo __DEV__ (apartado 5.5) con botones para
  avanzar 1 día, avanzar 10 días, terminar la temporada y volver al tiempo real.
  Sin él, probar el ciclo de temporadas desde la app es imposible. Que no
  aparezca nunca fuera de __DEV__.
- Toda cadena nueva va a src/i18n/index.ts en es, en y fr.
- Antes de escribir código de Expo, consulta
  https://docs.expo.dev/versions/v57.0.0/

NO HAGAS: la pantalla del reto diario (Fase 5) ni el chat (Fase 6).

TERMINA CUANDO: se pueda crear un grupo desde la app y otro dispositivo entre
con el código, y un grupo terminado se vea como tal. Actualiza el apartado 0.
```

---

## Fase 5 — Frontend: el reto diario

```
Vamos a implementar la Fase 5 (pantalla del reto diario). Las Fases 1 a 4 ya
están hechas.

CONTEXTO OBLIGATORIO:
- docs/00-EMPEZAR-AQUI.md
- docs/GRUPOS-RETO-DIARIO.md  (apartados 5, 6, 7, 8 y 9)
- AGENTS.md
- src/api/types.ts y src/api/endpoints.ts  (con lo de la Fase 4)
- las pantallas de grupo que escribiste en la Fase 4
- src/app/game.tsx              (REFERENCIA visual del bucle, no lo copies tal cual)
- src/components/SVGChallenge.tsx
- src/components/ColorWheel.tsx
- src/components/ResultSheet.tsx
- src/hooks/useChallenge.ts     (para ver qué NO reutilizar y por qué)
- src/design/*

NO LEAS: docs/PARTIDAS-ONLINE.md, src/app/party*.tsx, generated/challenges.json.

QUÉ HACER: las casillas de la Fase 5 del apartado 9. Un hook nuevo
useDailyChallenge que reciba las rondas del servidor, pantalla de preparación,
pantalla de juego reutilizando SVGChallenge y ColorWheel, envío del intento y
resultado con desglose.

CUIDADO CON:
- Los logos y el colorIndex los manda el SERVIDOR. No uses el editableColorIndex
  del catálogo local ni la selección aleatoria de useChallenge.
- El color objetivo solo se conoce al cerrar el intento, en la respuesta del
  servidor. No lo saques del catálogo local para adelantar la UI.
- Estados a cubrir: sin intentos restantes, reto cerrado, cuenta atrás al
  próximo, y sin ningún grupo activo (apartado 5.3) — en ese caso se puede
  jugar, pero avisando de que no cuenta para ninguna clasificación.
- Antes de escribir código de Expo, consulta
  https://docs.expo.dev/versions/v57.0.0/

TERMINA CUANDO: se pueda jugar el reto diario completo y la clasificación del
grupo se actualice. Actualiza el apartado 0.
```

---

## Fase 6 — Frontend: chat y avisos

```
Vamos a implementar la Fase 6 (chat de grupo y avisos en la app). Las Fases 1 a
5 ya están hechas.

CONTEXTO OBLIGATORIO:
- docs/00-EMPEZAR-AQUI.md
- docs/GRUPOS-RETO-DIARIO.md  (apartados 5, 7, 8 y 9)
- AGENTS.md
- src/api/types.ts y src/api/endpoints.ts
- las pantallas de grupo de la Fase 4
- src/design/Form.tsx, Avatar.tsx, Layout.tsx, tokens.ts
- src/i18n/index.ts  (sección "online.*")

NO LEAS: docs/PARTIDAS-ONLINE.md, ni nada de src/api/ relacionado con sockets
(no hay socket: el chat va por sondeo).

QUÉ HACER: las casillas de la Fase 6 del apartado 9. Pantalla de chat con lista
invertida y burbujas, sondeo con after=, historial hacia arriba con before=, y
el punto rojo de avisos sin leer.

CUIDADO CON:
- PARAR EL SONDEO al salir de la pantalla y al pasar la app a segundo plano. Si
  sigue corriendo, gasta batería y se come el limitador de ritmo del servidor.
- El chat funciona igual con el grupo terminado. No lo escondas ni lo bloquees.
- Marcar los avisos como leídos al abrir el grupo.
- Antes de escribir código de Expo, consulta
  https://docs.expo.dev/versions/v57.0.0/

TERMINA CUANDO: dos dispositivos conversen y los mensajes aparezcan en segundos,
y renovar un grupo deje el punto rojo al resto. Actualiza el apartado 0.
```

---

## Fase 7 — Remates

```
Vamos a hacer la Fase 7 (remates). Las Fases 1 a 6 ya están hechas.

CONTEXTO OBLIGATORIO:
- docs/00-EMPEZAR-AQUI.md
- docs/GRUPOS-RETO-DIARIO.md  (apartado 9, Fase 7)
- src/i18n/index.ts
- docs/ONLINE.md
- las pantallas de grupos, reto y chat que ya existen

QUÉ HACER: revisar que toda cadena visible esté en es/en/fr, reflejar el XP y el
nivel del reto diario en el perfil, repasar el fin de temporada de punta a punta
(clasificación congelada, chat vivo, renovación y aviso), y actualizar
docs/ONLINE.md con la estructura nueva.

TERMINA CUANDO: no quede texto sin traducir y docs/ONLINE.md describa la app
real. Actualiza el apartado 0.
```

---

## Consejos de uso

- **Una fase por sesión.** Mezclar dos hace que la IA pierda el hilo y gasta más
  cuota.
- **Si la sesión se corta a medias**, lo primero del siguiente prompt debe ser:
  *"Lee el apartado 0 de `GRUPOS-RETO-DIARIO.md` y dime qué falta de la Fase N
  antes de escribir nada."*
- **Si la IA propone tocar algo de la lista de "NO LEAS"**, párala. Casi siempre
  significa que ha confundido este trabajo con las partidas en tiempo real.
- **Si la IA propone borrar intentos o puntuaciones al renovar**, párala también:
  renovar no borra nada (apartado 3.3).
- **Al terminar, pídele explícitamente** que actualice el apartado 0 del plan.
  Es el único punto que depende de que alguien se acuerde.
