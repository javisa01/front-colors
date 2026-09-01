import AsyncStorage from "@react-native-async-storage/async-storage";

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
  groupNotifications: (groupId: string) => `${PREFIX}groupNotify:${groupId}`,
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
