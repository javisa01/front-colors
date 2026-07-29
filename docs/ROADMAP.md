# Color Quest — Roadmap y decisiones de arquitectura

Este documento recoge las funcionalidades **pospuestas a propósito** y la visión a
futuro. Se separan del código actual porque conviene resolverlas con una pequeña
API/backend en lugar de complicar la lógica del cliente, o porque necesitan
recursos (assets, audio) que aún no existen.

---

## 1. Multijugador (punto fuerte de la app) — REQUIERE BACKEND

La idea central: los retos **multijugador** son el diferencial del producto. Los
modos actuales (`quick`, `timed`, `daily`, `multicolor`) son **modos de práctica**
en solitario, equivalentes al "Juego rápido".

### Concepto

- Dos o más jugadores reciben **el mismo reto** (mismo logo, mismo color objetivo)
  y compiten por la mejor puntuación perceptual (CIEDE2000, ya implementada en
  [`src/utils/colorScore.ts`](../src/utils/colorScore.ts)).
- Modalidades: partida rápida (matchmaking), sala privada con código, y torneos.

### Por qué necesita API (no cliente puro)

- **Fuente de verdad del reto**: el servidor elige el logo/color y lo distribuye,
  evitando trampas (el cliente no debe conocer el color objetivo antes de tiempo).
- **Sincronización en tiempo real**: WebSocket / Realtime para estado de sala,
  cuenta atrás compartida y revelado simultáneo de resultados.
- **Ranking y anti-cheat**: la puntuación debe validarse en el servidor.

### Diseño propuesto (para implementar más adelante)

```
Cliente (Expo)  ──HTTP──▶  API REST        (salas, perfil, histórico)
                └─WS────▶  Realtime server (estado de partida en vivo)
```

- Endpoints REST sugeridos:
  - `POST /matches` — crear/entrar a una partida.
  - `GET  /matches/:id` — estado de la partida.
  - `POST /matches/:id/guess` — enviar `{ hsv }`; el servidor calcula el score.
  - `GET  /leaderboard` — ranking global/semanal.
- Reutilizar en el servidor las funciones **puras** ya extraídas
  (`calculateColorScore`, `summarizeRun`) portándolas a un paquete compartido, de
  modo que cliente y servidor puntúen exactamente igual.
- Autenticación ligera (perfil anónimo + nombre) para el MVP.

### Preparación ya hecha en el cliente

- La lógica de puntuación es **pura y aislada**, lista para compartirse.
- `GameMode` (en [`src/types/challenge.ts`](../src/types/challenge.ts)) puede
  ampliarse con `"versus"` sin tocar el bucle de juego (basado en _steps_).
- La persistencia local (`src/utils/storage.ts`) ya distingue récords por modo;
  añadir un modo online es aditivo.

---

## 2. Reto diario servido por API (opcional)

Hoy el **reto diario** es determinista en el cliente: se siembra un PRNG con la
fecha (`dailySeed()` en [`src/app/game.tsx`](../src/app/game.tsx)), de modo que
todos los jugadores del mismo día ven el mismo reto **sin backend**. Es suficiente
para el MVP.

Migrar a API tendría sentido cuando se quiera:

- Curar manualmente el reto del día.
- Publicar un ranking diario comparable entre usuarios.
- Evitar que se pueda inspeccionar el catálogo local para "adivinar" el diario.

Endpoint sugerido: `GET /daily?date=YYYY-MM-DD` → `{ challengeId, colorIndex }`.

---

## 3. Sonido — REQUIERE ASSETS DE AUDIO

Las vibraciones (haptics) ya están integradas (`src/utils/haptics.ts`). Falta el
audio porque necesita ficheros de sonido con licencia adecuada.

Plan cuando haya assets:

- `npx expo install expo-audio`.
- Efectos: _tick_ al mover el selector, _acierto_ (score ≥ 90), _fallo suave_,
  _fin de partida_.
- Añadir un ajuste de "silenciar" persistido en `storage.ts`.

---

## 4. Más categorías (banderas, Pantone, gradientes) — REQUIERE ASSETS/GENERACIÓN

El pipeline actual genera retos desde SVGs de logos
(`tools/generateMetadata.ts` → `generated/`). Para nuevas categorías:

- **Banderas**: añadir SVGs de banderas y una propiedad `category` en el metadata.
- **Pantone / colores planos**: no necesitan SVG; se puede generar un reto
  sintético (un rectángulo) a partir de una lista de colores objetivo.
- **Gradientes**: el jugador ajustaría 2 colores (encaja con el modo multicolor).

Cambios previstos:

- Extender `ChallengeMetadata` con `category?: "logo" | "flag" | "pantone" | ...`.
- Filtrar por categoría en `useChallenge` (ya filtra por nº de colores).
- Un selector de categoría en la Home.

---

## 5. Accesibilidad daltónica (siguiente paso)

Ya implementado: valores numéricos (HEX y delta H/S/V) en el modal de resultado,
que sirven como feedback no dependiente del color.

Pendiente: **patrones/etiquetas** sobre las muestras de color (p. ej. texturas o
nombres de color aproximados) para reforzar la distinción sin depender del tono.

---

## Estado actual (implementado en esta iteración)

- Puntuación perceptual **CIEDE2000** con mapeo a 0..100.
- Puntuación **acumulada** + pantalla de **resumen** (total, media, estrellas).
- **Récord persistente** por modo y **mejor racha** (Contrarreloj), con
  `@react-native-async-storage/async-storage`.
- Modos **Contrarreloj** (timer + racha) y **Reto diario** (determinista por fecha).
- Modo **Multicolor** para logos con **más de 2 colores** (se resuelven uno a uno).
- **Reanudar partida** (progreso guardado por paso).
- Feedback enriquecido: **comparación lado a lado** + **delta H/S/V** + valores
  numéricos (accesibilidad).
- **Haptics** según el acierto.
- **Compartir** resultado (API nativa `Share`, estilo Wordle).
- **i18n** (`src/i18n/`) — todas las cadenas nuevas pasan por `t()`.
- **Tests unitarios** de `color.ts` y `colorScore.ts` (`npm test`).
