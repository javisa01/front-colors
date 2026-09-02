import AsyncStorage from "@react-native-async-storage/async-storage";

import { isLocale, type Locale } from "@/i18n";
import type { GameMode, PartyMode } from "@/types/challenge";

// All persisted keys live under a single namespace so they are easy to find and
// wipe. Bump the version suffix if the stored shape ever changes in a breaking
// way.
const PREFIX = "colorquest:v1:";

/**
 * Sufijo de la clave del récord cuando un modo cambia de escala de puntuación.
 *
 * El contrarreloj puntuaba sumando la precisión cruda de ocho intentos —hasta
 * 800—, y ahora puntúa con penalización y sin límite de imágenes, donde una
 * buena partida ronda los cien puntos. Sin estrenar clave, el récord guardado
 * con las reglas viejas se quedaría arriba para siempre y ninguna partida nueva
 * podría batirlo.
 *
 * El reloj bajó después de 45 a 30 segundos, que es el mismo problema con otra
 * cara: en un tercio menos de tiempo caben un tercio menos de intentos, así que
 * un récord conseguido con el reloj largo dejaría el marcador congelado. De ahí
 * el `30` en el sufijo.
 */
const SCORING_SCHEME: Partial<Record<GameMode, string>> = {
  timed: ":pts30",
};

const KEYS = {
  highScore: (mode: GameMode) =>
    `${PREFIX}highscore:${mode}${SCORING_SCHEME[mode] ?? ""}`,
  bestStreak: (mode: GameMode) => `${PREFIX}beststreak:${mode}`,
  teamAverage: (mode: PartyMode) => `${PREFIX}teamaverage:${mode}`,
  progress: `${PREFIX}progress`,
  dailyResult: `${PREFIX}daily`,
  musicVolume: `${PREFIX}musicVolume`,
  sfxVolume: `${PREFIX}sfxVolume`,
  language: `${PREFIX}language`,
  groupNotifications: (groupId: string) => `${PREFIX}groupNotify:${groupId}`,
  tutorialSeen: `${PREFIX}tutorialSeen`,
  practiceTourSeen: `${PREFIX}practiceTourSeen`,
  onlineTourSeen: `${PREFIX}onlineTourSeen`,
  landing: `${PREFIX}landing`,
} as const;

async function readJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best-effort; never let a storage failure crash the game.
  }
}

async function readNumber(key: string): Promise<number> {
  const value = await readJSON<number>(key);
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// ---------------------------------------------------------------------------
// High score (per mode)
// ---------------------------------------------------------------------------

export interface HighScoreResult {
  best: number;
  isRecord: boolean;
}

export async function getHighScore(mode: GameMode): Promise<number> {
  return readNumber(KEYS.highScore(mode));
}

export async function submitHighScore(
  mode: GameMode,
  score: number,
): Promise<HighScoreResult> {
  const previous = await getHighScore(mode);
  if (score > previous) {
    await writeJSON(KEYS.highScore(mode), score);
    return { best: score, isRecord: true };
  }
  return { best: previous, isRecord: false };
}

// ---------------------------------------------------------------------------
// Best streak (per mode, used by the timed mode)
// ---------------------------------------------------------------------------

export async function getBestStreak(mode: GameMode): Promise<number> {
  return readNumber(KEYS.bestStreak(mode));
}

export async function submitBestStreak(
  mode: GameMode,
  streak: number,
): Promise<HighScoreResult> {
  const previous = await getBestStreak(mode);
  if (streak > previous) {
    await writeJSON(KEYS.bestStreak(mode), streak);
    return { best: streak, isRecord: true };
  }
  return { best: previous, isRecord: false };
}

// ---------------------------------------------------------------------------
// Récord de equipo (modos colaborativos en grupo)
// ---------------------------------------------------------------------------

/**
 * En los modos colaborativos el récord es la **media de precisión** del equipo,
 * no su puntuación.
 *
 * Los puntos de un colaborativo no se pueden comparar entre partidas: dependen
 * de cuánta gente juega —cada jugador añade sus imágenes al total— y, en el
 * colaborativo contrarreloj, de cuántos intentos dio tiempo a hacer. Cuatro
 * jugadores mediocres superan siempre a dos jugadores finos, así que un récord
 * de puntos solo mediría el tamaño de la mesa. La media en porcentaje sí mide
 * lo mismo con dos jugadores que con doce: lo bien que ve los colores el equipo.
 */
export async function getTeamAverageRecord(mode: PartyMode): Promise<number> {
  return readNumber(KEYS.teamAverage(mode));
}

export async function submitTeamAverageRecord(
  mode: PartyMode,
  average: number,
): Promise<HighScoreResult> {
  const previous = await getTeamAverageRecord(mode);
  if (average > previous) {
    await writeJSON(KEYS.teamAverage(mode), average);
    return { best: average, isRecord: true };
  }
  return { best: previous, isRecord: false };
}

// ---------------------------------------------------------------------------
// In-progress run (resume a game after leaving the app)
// ---------------------------------------------------------------------------

export interface SavedProgress {
  mode: GameMode;
  challengeIds: string[];
  stepIndex: number;
  scores: number[];
  savedAt: number;
}

export async function saveProgress(progress: SavedProgress): Promise<void> {
  await writeJSON(KEYS.progress, progress);
}

export async function loadProgress(): Promise<SavedProgress | null> {
  const progress = await readJSON<SavedProgress>(KEYS.progress);
  if (
    progress &&
    Array.isArray(progress.challengeIds) &&
    Array.isArray(progress.scores) &&
    typeof progress.stepIndex === "number"
  ) {
    return progress;
  }
  return null;
}

export async function clearProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.progress);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Daily challenge result (one attempt per calendar day)
// ---------------------------------------------------------------------------

export interface DailyResult {
  dateKey: string;
  score: number;
}

export async function getDailyResult(): Promise<DailyResult | null> {
  return readJSON<DailyResult>(KEYS.dailyResult);
}

export async function setDailyResult(result: DailyResult): Promise<void> {
  await writeJSON(KEYS.dailyResult, result);
}

// ---------------------------------------------------------------------------
// Volume settings
// ---------------------------------------------------------------------------

export async function getMusicVolume(): Promise<number> {
  const v = await readJSON<number>(KEYS.musicVolume);
  return typeof v === "number" && Number.isFinite(v) ? v : 0.5;
}

export async function setMusicVolume(volume: number): Promise<void> {
  await writeJSON(KEYS.musicVolume, volume);
}

export async function getSfxVolume(): Promise<number> {
  const v = await readJSON<number>(KEYS.sfxVolume);
  return typeof v === "number" && Number.isFinite(v) ? v : 1;
}

export async function setSfxVolume(volume: number): Promise<void> {
  await writeJSON(KEYS.sfxVolume, volume);
}

// ---------------------------------------------------------------------------
// Idioma
// ---------------------------------------------------------------------------

/**
 * El idioma **elegido a mano**, o `null` si nunca se ha tocado.
 *
 * La ausencia de valor es información, no un hueco que rellenar con un idioma
 * por defecto: significa «sigue al dispositivo», que es lo que hace la app
 * mientras nadie diga lo contrario. Por eso esto devuelve `null` y no `"es"`;
 * quien decide el idioma de partida es `detectLocale()` en `@/i18n`, no el
 * almacenamiento.
 *
 * Se valida contra la lista real de idiomas: un valor guardado por una versión
 * anterior con más idiomas de los que hoy existen dejaría la app en un
 * diccionario que ya no está.
 */
export async function getLanguage(): Promise<Locale | null> {
  const value = await readJSON<string>(KEYS.language);
  return isLocale(value) ? value : null;
}

export async function setLanguage(locale: Locale): Promise<void> {
  await writeJSON(KEYS.language, locale);
}

// ---------------------------------------------------------------------------
// Avisos de un grupo
// ---------------------------------------------------------------------------

/**
 * Si el jugador quiere que un grupo le llame la atención.
 *
 * Gobierna **el punto rojo** de ese grupo: en la lista, en el menú y en la
 * pestaña. Apagado, los avisos se siguen creando en el servidor y se siguen
 * leyendo al abrir el grupo —lo que pasó, pasó—; lo que no ocurre es que el
 * grupo interrumpa.
 *
 * Vive en el teléfono y no en el servidor **a propósito, y de momento**: no hay
 * push, así que el servidor no tiene ninguna decisión que tomar con esto. Es
 * una preferencia de esta pantalla, y silenciar un grupo en el móvil no tiene
 * por qué silenciarlo en la tableta. Cuando exista el push de verdad, pasa a
 * `PATCH /groups/:id/members/me` y este par de funciones se queda como caché.
 *
 * Por defecto **encendido**: quien entra en un grupo quiere enterarse de lo que
 * pasa en él.
 */
export async function getGroupNotifications(groupId: string): Promise<boolean> {
  const value = await readJSON<boolean>(KEYS.groupNotifications(groupId));
  return typeof value === "boolean" ? value : true;
}

export async function setGroupNotifications(
  groupId: string,
  enabled: boolean,
): Promise<void> {
  await writeJSON(KEYS.groupNotifications(groupId), enabled);
}

/**
 * Qué grupos tienen los avisos apagados, en una sola lectura.
 *
 * La preferencia se guarda con una clave por grupo, que es lo cómodo para la
 * pantalla de ajustes —lee y escribe una—, pero lo caro para las listas, que
 * necesitan todas a la vez. `multiGet` las trae de una tacada.
 *
 * El resultado se indexa por clave y no por posición: `multiGet` devuelve los
 * pares en el orden pedido en las implementaciones que usamos, pero no es algo
 * que el contrato garantice, y confiar en ello silenciaría el grupo equivocado.
 *
 * Ante cualquier fallo devuelve el conjunto vacío: **nadie silenciado**. Es el
 * fallo bueno; perder un punto rojo es peor que enseñar uno de más.
 */
export async function getMutedGroups(groupIds: string[]): Promise<Set<string>> {
  if (groupIds.length === 0) {
    return new Set();
  }

  try {
    const pairs = await AsyncStorage.multiGet(
      groupIds.map((id) => KEYS.groupNotifications(id)),
    );
    const byKey = new Map(pairs.map(([key, value]) => [key, value]));

    return new Set(
      groupIds.filter(
        (id) => byKey.get(KEYS.groupNotifications(id)) === "false",
      ),
    );
  } catch {
    return new Set();
  }
}

// ---------------------------------------------------------------------------
// El tutorial de la primera vez
// ---------------------------------------------------------------------------

/**
 * Si ya se ha visto la bienvenida.
 *
 * ## Por qué hay una copia en memoria
 *
 * La portada tiene que decidir **en su primer render** si se aparta para dejar
 * paso al tutorial, y una lectura de `AsyncStorage` es asíncrona: consultarla
 * desde la pantalla enseñaría la portada un instante antes de taparla. Ese
 * parpadeo es justo el que el splash ya está evitando con las tipografías y el
 * idioma.
 *
 * Así que el layout raíz lee el valor **antes de retirar el splash**
 * (`loadTutorialSeen`) y lo deja aquí; a partir de ese momento la portada lo
 * consulta de forma síncrona (`tutorialSeenSync`) y decide sin esperar a nadie.
 *
 * Mientras no se haya leído, la respuesta es `true` — «no molestes». Un fallo
 * de almacenamiento debe costar un tutorial que no se enseña, nunca uno que
 * reaparece cada vez que se abre la aplicación.
 */
let seenCache: boolean | null = null;

export async function loadTutorialSeen(): Promise<boolean> {
  const value = await readJSON<boolean>(KEYS.tutorialSeen);
  seenCache = value === true;
  return seenCache;
}

/** Solo vale después de `loadTutorialSeen`. Ver arriba. */
export function tutorialSeenSync(): boolean {
  return seenCache ?? true;
}

export async function setTutorialSeen(seen: boolean): Promise<void> {
  // La copia en memoria se actualiza ANTES de escribir: quien navega justo
  // detrás de esta llamada lee el valor nuevo aunque el disco vaya lento.
  seenCache = seen;
  await writeJSON(KEYS.tutorialSeen, seen);
}

// ---------------------------------------------------------------------------
// Pista de portada
// ---------------------------------------------------------------------------

/**
 * Lo que la portada necesita saber del modo online **sin poder preguntárselo**.
 *
 * ## Por qué existe
 *
 * La portada es la raíz de la aplicación, y la raíz no monta `ClerkProvider` ni
 * `SessionProvider` — esa es la frontera que mantiene el modo offline offline
 * (ver `docs/ONLINE.md`). Así que la portada no puede preguntar si hay sesión ni
 * cuántos grupos hay: importar `@/online` desde aquí arrancaría el cliente de
 * Clerk al abrir la app para jugar sin conexión, que es exactamente lo que la
 * arquitectura evita.
 *
 * La salida es invertir quién habla: el área online **deja escrito** lo que sabe
 * y la portada lo lee. Es una clave del almacenamiento offline, sin tokens y sin
 * nada personal más allá del nombre, y la escribe el hub online cada vez que
 * carga su día.
 *
 * ## Es una pista, no una verdad
 *
 * Puede estar caducada: si la sesión expira en el servidor, la portada seguirá
 * enseñando el estado de la última vez hasta que se entre en el área online y
 * esta se corrija. Y da igual, porque **la portada no decide nada con esto**:
 * solo elige qué enseñar y a dónde apunta el dial. Quien manda sigue siendo el
 * área online, que comprueba la sesión de verdad al entrar. Lo peor que puede
 * pasar es un rótulo optimista durante un toque.
 *
 * Se lee antes de retirar el splash, igual que la marca del tutorial y por el
 * mismo motivo: la portada tiene que elegir su estado en el primer render o se
 * vería cambiar la pantalla debajo del dedo.
 */
export interface LandingHint {
  /** Había sesión la última vez que el área online miró. */
  signedIn: boolean;
  /** Cuántos grupos tenía. Sin grupos no hay reto que jugar. */
  groups: number;
  /** Jornadas seguidas, para la cinta de la portada. */
  streak: number;
  /** Si la racha de hoy ya está asegurada. */
  streakSecured: boolean;
  /** Nombre de jugador, para saludar. Vacío si no se sabe. */
  username: string;
}

const NO_SESSION: LandingHint = {
  signedIn: false,
  groups: 0,
  streak: 0,
  streakSecured: false,
  username: "",
};

function isHint(value: unknown): value is LandingHint {
  const hint = value as LandingHint | null;
  return (
    !!hint &&
    typeof hint.signedIn === "boolean" &&
    typeof hint.groups === "number" &&
    typeof hint.streak === "number" &&
    typeof hint.streakSecured === "boolean" &&
    typeof hint.username === "string"
  );
}

let landingCache: LandingHint | null = null;

export async function loadLanding(): Promise<LandingHint> {
  const value = await readJSON<unknown>(KEYS.landing);
  landingCache = isHint(value) ? value : NO_SESSION;
  return landingCache;
}

/**
 * Solo vale después de `loadLanding`. Mientras tanto responde «nadie»: una
 * portada que empieza pidiendo cuenta y se corrige es mejor que una que saluda
 * por su nombre a quien no ha entrado nunca.
 */
export function landingSync(): LandingHint {
  return landingCache ?? NO_SESSION;
}

export async function setLanding(hint: LandingHint): Promise<void> {
  // La copia en memoria primero, igual que en la marca del tutorial: quien
  // vuelva a la portada justo detrás de esto lee ya el valor nuevo.
  landingCache = hint;
  await writeJSON(KEYS.landing, hint);
}

/** Al cerrar sesión. La portada vuelve a su estado de invitado. */
export async function clearLanding(): Promise<void> {
  landingCache = NO_SESSION;
  await writeJSON(KEYS.landing, NO_SESSION);
}

// ---------------------------------------------------------------------------
// Recorrido de la pantalla de práctica
// ---------------------------------------------------------------------------

/**
 * Si ya se ha visto el foco que explica el menú de práctica.
 *
 * A diferencia de la marca del tutorial, esta **no** se lee antes de retirar el
 * splash ni tiene copia síncrona, y es deliberado: el recorrido no aparece en el
 * primer fotograma —espera a que la pantalla termine de entrar para poder
 * medirla— así que una lectura asíncrona llega de sobra. Meterla en la espera
 * del arranque sería pagar en el tiempo de apertura de la aplicación por algo
 * que solo hace falta medio segundo más tarde y solo dentro de una pantalla.
 *
 * Sin marca guardada la respuesta es `false`, que es lo que hace que el
 * recorrido salga la primera vez. Es la misma regla que `loadTutorialSeen`.
 */
export async function loadPracticeTourSeen(): Promise<boolean> {
  return (await readJSON<boolean>(KEYS.practiceTourSeen)) === true;
}

export async function setPracticeTourSeen(seen: boolean): Promise<void> {
  await writeJSON(KEYS.practiceTourSeen, seen);
}

/**
 * Si ya se ha visto el recorrido de la barra de pestañas del modo online.
 *
 * Es una marca **aparte** de la de práctica, y no un contador de «tutoriales
 * vistos», porque los dos modos se estrenan en momentos distintos: se puede
 * llevar semanas jugando sin conexión y entrar hoy por primera vez en el
 * online. Compartir marca dejaría a esa persona sin la explicación de la única
 * parte de la app que no ha visto nunca.
 *
 * Vive en el almacenamiento **del dispositivo** y no en la cuenta, igual que
 * las otras dos. Es lo correcto para lo que es: no se explica una cuenta, se
 * explica una pantalla, y quien cambia de teléfono se encuentra una barra que
 * no ha usado en ese teléfono.
 */
export async function loadOnlineTourSeen(): Promise<boolean> {
  return (await readJSON<boolean>(KEYS.onlineTourSeen)) === true;
}

export async function setOnlineTourSeen(seen: boolean): Promise<void> {
  await writeJSON(KEYS.onlineTourSeen, seen);
}
