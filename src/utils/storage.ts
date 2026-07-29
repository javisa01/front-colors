import AsyncStorage from "@react-native-async-storage/async-storage";

import type { GameMode } from "@/types/challenge";

// All persisted keys live under a single namespace so they are easy to find and
// wipe. Bump the version suffix if the stored shape ever changes in a breaking
// way.
const PREFIX = "colorquest:v1:";

const KEYS = {
  highScore: (mode: GameMode) => `${PREFIX}highscore:${mode}`,
  bestStreak: (mode: GameMode) => `${PREFIX}beststreak:${mode}`,
  progress: `${PREFIX}progress`,
  dailyResult: `${PREFIX}daily`,
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
