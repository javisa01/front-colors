import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ThemeMode } from "@/design/theme";
import { isLocale, type Locale } from "@/i18n";
import type { DailyAnswer } from "@/api/types";
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
  dailyRun: `${PREFIX}dailyRun`,
  dailyResult: `${PREFIX}daily`,
  musicVolume: `${PREFIX}musicVolume`,
  sfxVolume: `${PREFIX}sfxVolume`,
  language: `${PREFIX}language`,
  theme: `${PREFIX}theme`,
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
// El intento del reto diario, a medias
// ---------------------------------------------------------------------------

/**
 * Un intento del reto diario que se ha quedado sin terminar.
 *
 * Existe por un agujero concreto: las respuestas del reto viven en memoria y el
 * intento se manda **entero al final**. Salir de la partida antes de la última
 * ronda —el botón «atrás» del móvil está a un dedo del de comprobar— no perdía
 * solo el progreso: como el servidor no se había enterado de nada, el intento
 * tampoco contaba, así que se podían ver las cinco imágenes, salir al ver que
 * la cuarta había ido mal y empezar de cero con los dos intentos intactos.
 *
 * Guardado aquí, volver a entrar continúa donde se dejó y ese camino se cierra.
 *
 * OJO con lo que esto NO es: una defensa de verdad. Vive en el teléfono, así
 * que quien borre los datos de la aplicación vuelve a empezar. Cerrarlo del
 * todo pide que el intento lo abra el servidor —un `POST` al empezar y las
 * rondas contra ese intento—, y eso es un cambio de backend.
 */
export interface SavedDailyRun {
  groupId: string;
  challengeId: string;
  answers: DailyAnswer[];
  /** En qué ronda se quedó, para volver a abrir esa y no la primera. */
  roundIndex: number;
  savedAt: number;
}

export async function saveDailyRun(run: SavedDailyRun): Promise<void> {
  await writeJSON(KEYS.dailyRun, run);
}

/**
 * El intento a medias, **solo si es de este reto y de este grupo**.
 *
 * La comprobación va aquí y no en quien llama porque un intento de ayer, o del
 * mismo día en otro grupo, no es un intento a medias: es basura que haría
 * empezar con respuestas que no son de estas imágenes.
 */
export async function loadDailyRun(
  groupId: string,
  challengeId: string,
): Promise<SavedDailyRun | null> {
  const run = await readJSON<SavedDailyRun>(KEYS.dailyRun);
  if (
    run &&
    run.groupId === groupId &&
    run.challengeId === challengeId &&
    Array.isArray(run.answers) &&
    typeof run.roundIndex === "number"
  ) {
    return run;
  }
  return null;
}

export async function clearDailyRun(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.dailyRun);
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
// Tema
// ---------------------------------------------------------------------------

/**
 * El tema elegido, o `null` si nunca se ha tocado.
 *
 * `null` significa «el de siempre»: la app nació oscura y así se queda mientras
 * nadie diga lo contrario, igual que el idioma cae al del teléfono. Se valida
 * el valor leído porque el almacenamiento sobrevive a versiones de la app: un
 * valor desconocido cae a `null`, no revienta.
 */
export async function getThemeMode(): Promise<ThemeMode | null> {
  const value = await readJSON<string>(KEYS.theme);
  return value === "light" || value === "dark" ? value : null;
}

export async function setThemeMode(mode: ThemeMode): Promise<void> {
  await writeJSON(KEYS.theme, mode);
}

// ---------------------------------------------------------------------------
// Avisos de un grupo: ya no viven aquí
// ---------------------------------------------------------------------------

/*
  Aquí estaban `getGroupNotifications`, `setGroupNotifications` y
  `getMutedGroups`, y ya no hacen falta.

  La preferencia vivía en el teléfono porque no había push: el servidor no tenía
  ninguna decisión que tomar con ella y silenciar un grupo era solo apagar un
  punto rojo local. Ahora el servidor manda avisos de verdad al teléfono, así
  que es él quien tiene que saber a quién no escribir, y la preferencia se
  guarda en `group_notification_prefs` y viaja con cada grupo como
  `notificationsEnabled`.

  La ganancia no es solo de arquitectura: el interruptor cumple lo que promete
  en los dos sentidos —ni empujones ni punto rojo— y apagarlo en el móvil lo
  apaga también en la tableta.

  Las claves `colors:groupNotify:<id>` que quedaran escritas en instalaciones
  antiguas se vuelven inertes. No se borran a propósito: un barrido de claves al
  arrancar cuesta más que los pocos bytes que ocupan.

  Ver `GET /api/groups`, `PUT /api/groups/:id/notifications` y `@/online/push`.
*/

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
