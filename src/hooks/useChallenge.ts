import { useCallback, useMemo, useState } from "react";

import type {
  ChallengeMetadata,
  ChallengeStep,
  GameMode,
  HSVColor,
} from "@/types/challenge";
import { hexToHSV, hsvToHex } from "@/utils/color";
import type { SavedProgress } from "@/utils/storage";
import challengeCatalog from "../../generated/challenges.json";

const INITIAL_COLOR = "#878787";

/**
 * Color de arranque de cada paso, en HSV.
 *
 * El HSV es la fuente de verdad de la selección y el hexadecimal se deriva de
 * él, nunca al revés. Guardar el hex y reconstruir el HSV a partir de él es
 * justo lo que rompía el selector de color: la cuantización a 8 bits destruye el
 * tono cuando la saturación es baja. Ver `components/ColorWheel.tsx`.
 */
export const INITIAL_HSV: HSVColor = hexToHSV(INITIAL_COLOR);

// DEV: Set this to an array of logo IDs to force only those logos to appear in
// any game mode. Leave as null (or empty) for normal random behavior.
// Example: ["spotify", "google", "2xko"]
const DEV_ONLY_LOGOS: string[] | null = ["word"]

/**
 * El contrarreloj no tiene lista: la partida la termina el cronómetro.
 *
 * Antes servía ocho imágenes y se acababa ahí, así que el modo premiaba llegar
 * al final más que aprovechar el tiempo. Ahora se baraja el catálogo entero,
 * igual que los modos contrarreloj en grupo reparten una baraja larga: en 30
 * segundos no se acaba, y en la práctica eso es «las que te dé tiempo».
 */
const UNLIMITED = Number.POSITIVE_INFINITY;

// How many challenges each mode serves up. Multicolor is driven by the number
// of colors per logo instead of a fixed challenge count.
const COUNT_BY_MODE: Record<GameMode, number> = {
  quick: 5,
  timed: UNLIMITED,
  daily: 3,
  multicolor: 2,
};

// Multicolor only makes sense for logos with more than two colors, but a logo
// with dozens of colors would be exhausting, so we cap the range to keep a run
// playable.
const MULTICOLOR_MIN_COLORS = 3;
const MULTICOLOR_MAX_COLORS = 5;

export interface UseChallengeOptions {
  mode: GameMode;
  seed?: number;
  resume?: SavedProgress | null;
}

export interface UseChallengeResult {
  mode: GameMode;
  steps: ChallengeStep[];
  currentStep: ChallengeStep | null;
  currentStepIndex: number;
  totalSteps: number;
  challengeIds: string[];
  /** Derivado de `selectedHSV`. Solo para pintar; nunca se vuelve a convertir. */
  selectedColor: string;
  selectedHSV: HSVColor;
  setSelectedHSV: (hsv: HSVColor) => void;
  nextStep: () => boolean;
  restartGame: () => void;
  resetSelection: () => void;
}

function getCatalog(): ChallengeMetadata[] {
  const all = (challengeCatalog as ChallengeMetadata[]).filter(
    (item) => item?.id && Array.isArray(item?.colors) && item.colors.length > 0,
  );
  if (DEV_ONLY_LOGOS && DEV_ONLY_LOGOS.length > 0) {
    return all.filter((item) => DEV_ONLY_LOGOS.includes(item.id));
  }
  return all;
}

function loadChallengeMetadata(challengeId: string): ChallengeMetadata | null {
  const metadata = getCatalog().find((item) => item.id === challengeId);
  if (!metadata) {
    return null;
  }

  return {
    ...metadata,
    svgXml: metadata.svgXml ?? "",
    editableColorIndex: metadata.editableColorIndex ?? 0,
  };
}

// Deterministic PRNG so the daily challenge is identical for everyone on a given
// day without needing a server.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickChallengeIds(mode: GameMode, seed?: number): string[] {
  const catalog = getCatalog();
  const random = seed != null ? mulberry32(seed) : () => Math.random();

  if (mode === "multicolor") {
    const multi = catalog.filter(
      (item) =>
        item.colors.length >= MULTICOLOR_MIN_COLORS &&
        item.colors.length <= MULTICOLOR_MAX_COLORS,
    );
    return shuffle(multi, random)
      .slice(0, COUNT_BY_MODE.multicolor)
      .map((item) => item.id);
  }

  return shuffle(catalog, random)
    .slice(0, COUNT_BY_MODE[mode])
    .map((item) => item.id);
}

// Expand the ordered challenge ids into a flat list of guessing steps. Single
// color modes emit one step per challenge; multicolor emits one per color.
function buildSteps(
  challengeIds: readonly string[],
  mode: GameMode,
): ChallengeStep[] {
  const steps: ChallengeStep[] = [];

  for (const id of challengeIds) {
    const challenge = loadChallengeMetadata(id);
    if (!challenge) {
      continue;
    }

    if (mode === "multicolor") {
      challenge.colors.forEach((target, colorIndex) => {
        steps.push({
          challenge,
          colorIndex,
          target,
          colorPosition: colorIndex + 1,
          colorCount: challenge.colors.length,
        });
      });
      continue;
    }

    const colorIndex = challenge.editableColorIndex ?? 0;
    const target = challenge.colors[colorIndex];
    if (!target) {
      continue;
    }

    steps.push({
      challenge,
      colorIndex,
      target,
      colorPosition: 1,
      colorCount: 1,
    });
  }

  return steps;
}

export function useChallenge(options: UseChallengeOptions): UseChallengeResult {
  const { mode, seed, resume } = options;

  const challengeIds = useMemo(() => {
    if (resume && resume.mode === mode && resume.challengeIds.length > 0) {
      return resume.challengeIds;
    }
    return pickChallengeIds(mode, seed);
    // A fresh set is only computed when the mode/seed changes; `resume` is read
    // once on mount to rehydrate a saved run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, seed]);

  const steps = useMemo(
    () => buildSteps(challengeIds, mode),
    [challengeIds, mode],
  );

  const initialIndex =
    resume && resume.mode === mode
      ? Math.min(Math.max(resume.stepIndex, 0), Math.max(steps.length - 1, 0))
      : 0;

  const [currentStepIndex, setCurrentStepIndex] = useState(initialIndex);
  const [selectedHSV, setSelectedHSVState] = useState<HSVColor>(INITIAL_HSV);

  const currentStep = steps[currentStepIndex] ?? null;

  // Un único estado, una única conversión y en un solo sentido.
  const selectedColor = useMemo(
    () => hsvToHex(selectedHSV.h, selectedHSV.s, selectedHSV.v),
    [selectedHSV],
  );

  const resetSelection = useCallback((): void => {
    setSelectedHSVState(INITIAL_HSV);
  }, []);

  const setSelectedHSV = useCallback((hsv: HSVColor): void => {
    setSelectedHSVState(hsv);
  }, []);

  const nextStep = useCallback((): boolean => {
    if (currentStepIndex >= steps.length - 1) {
      return false;
    }
    setCurrentStepIndex((value) => value + 1);
    // Reset the picker as we land on the next step.
    resetSelection();
    return true;
  }, [currentStepIndex, steps.length, resetSelection]);

  const restartGame = useCallback((): void => {
    setCurrentStepIndex(0);
    resetSelection();
  }, [resetSelection]);

  return {
    mode,
    steps,
    currentStep,
    currentStepIndex,
    totalSteps: steps.length,
    challengeIds,
    selectedColor,
    selectedHSV,
    setSelectedHSV,
    nextStep,
    restartGame,
    resetSelection,
  };
}
