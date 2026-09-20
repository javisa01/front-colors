import { useCallback, useMemo, useState } from "react";

import type {
  ChallengeCategory,
  ChallengeMetadata,
  ChallengeStep,
  GameMode,
  HSVColor,
} from "@/types/challenge";
import { allPlayable, catalogFor } from "@/utils/catalog";
import { hexToHSV, hsvToHex } from "@/utils/color";
import type { SavedProgress } from "@/utils/storage";

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

/**
 * DEV: lista de ids que sustituye al catálogo en **todos** los modos. `null`
 * para jugar normal.
 *
 * Pisa el reparto por familia de `CATEGORY_BY_MODE` en vez de filtrar dentro de
 * él, y esa es la diferencia que lo hace útil: si filtrase dentro, poner aquí
 * banderas dejaría «Juego rápido» —que reparte logos— con cero retos y la
 * pantalla de «no hay retos disponibles».
 *
 * Para volver a revisar todas las banderas de una tanda:
 *
 *   const DEV_ONLY_LOGOS = allPlayable()
 *     .filter((item) => item.category === "flag")
 *     .map((item) => item.id);
 *
 * Derivado del catálogo y no con los ids escritos a mano: una lista copiada se
 * queda vieja en cuanto se importe la bandera siguiente.
 */
/*
  TANDA EN REVISIÓN: los 32 logos importados el 2026-09-20.

  Mientras esta lista no sea `null`, TODOS los modos reparten solo estos y el
  catálogo de verdad no sale por ningún lado. **Hay que devolverla a `null`
  antes de publicar nada**: es una lista de desarrollo, no una configuración.

  Los cinco marcados abajo cambiaron de color jugable al medirlos por área con
  `npm run measure:assets`, así que son los que más conviene mirar: la
  heurística del generador los había resuelto por número de formas y en dos
  de ellos el color elegido no se veía en pantalla.
*/
const DEV_ONLY_LOGOS: string[] | null = [
  "adobe",
  "air_japan",
  "aldi",
  "bing",
  "bluetooth",
  "cockta", // ← área: amarillo 37 % → rojo 60 %
  "dc_comics",
  "disney_channel",
  "disney_plus",
  "galatasaray",
  "google_sheets", // ← área: gris 0 % → verde 94 %
  "grido", // ← área: amarillo 23 % → azul 75 %
  "intel",
  "kenzo", // ← área: verde 1 % → rojo 99 %
  "kodak", // ← área: rojo 46 % → amarillo 54 %
  "lime",
  "louis_vuitton",
  "mg",
  "mlb",
  "mundial_78",
  "nickelodeon",
  "nintendo_3ds",
  "nivea",
  "nordkalk",
  "nv_energy",
  "procter_gamble",
  "rai",
  "riyadh_air",
  "shopify",
  "sony_interactive",
  "viettel",
  "walmart",
];

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
  // Siete y no cinco: una bandera se reconoce de un vistazo, así que el modo
  // corre más que el de logos y con cinco se acababa antes de coger el ritmo.
  flags: 7,
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

/**
 * Familia de imagen de cada modo. `null` es «los logos de siempre», no «todo»:
 * ver la nota de `utils/catalog`.
 */
const CATEGORY_BY_MODE: Record<GameMode, ChallengeCategory | null> = {
  quick: null,
  timed: null,
  daily: null,
  multicolor: null,
  flags: "flag",
};

function getCatalog(mode: GameMode): ChallengeMetadata[] {
  if (DEV_ONLY_LOGOS && DEV_ONLY_LOGOS.length > 0) {
    const only = allPlayable().filter((item) => DEV_ONLY_LOGOS.includes(item.id));

    /*
      Un id de la lista que no esté en el catálogo no rompe nada ruidosamente:
      se cae del filtro y el modo reparte menos retos, o ninguno. Con ninguno la
      pantalla se queda vacía **sin decir por qué**, y el motivo casi nunca está
      en esta lista — está en que el bundle todavía lleva el `challenges.json`
      anterior, porque Metro cachea los JSON y un logo recién generado no entra
      con un refresco en caliente. Se arregla reiniciando con `--clear`.

      Solo en desarrollo, que es lo único donde esta lista debería existir.
    */
    if (__DEV__ && only.length < DEV_ONLY_LOGOS.length) {
      const faltan = DEV_ONLY_LOGOS.filter(
        (id) => !only.some((item) => item.id === id),
      );
      console.warn(
        `[DEV_ONLY_LOGOS] ${faltan.length} de ${DEV_ONLY_LOGOS.length} ids no ` +
          `están en el catálogo: ${faltan.join(", ")}.
` +
          (only.length === 0
            ? "No queda ningún reto que repartir, así que el juego saldrá vacío. " +
              "Si acabas de generarlos, reinicia Metro con `npx expo start --clear`."
            : "Revisa que estén escritos igual que en generated/challenges.json."),
      );
    }

    return only;
  }
  return catalogFor(CATEGORY_BY_MODE[mode]);
}

/**
 * Si una partida guardada se puede retomar **con el catálogo de ahora**.
 *
 * Una partida guardada es una lista de ids, y los ids pueden dejar de existir
 * entre una sesión y la siguiente: al retirar un logo del catálogo, al cambiar
 * uno de nombre, y sobre todo al encender `DEV_ONLY_LOGOS`, que deja fuera al
 * resto de golpe.
 *
 * Cuando eso pasa, retomar era peor que no retomar: `buildSteps` resuelve cada
 * id contra el catálogo y descarta los que no encuentra, así que la partida se
 * rehidrataba con **cero pasos** y la pantalla se quedaba en blanco sin decir
 * por qué. Y es un silencio caro: el modo que más se juega es el que guarda
 * progreso, así que el fallo aparecía justo al abrir el juego.
 *
 * Se exige que estén **todos**, no la mayoría: una partida a la que le faltan
 * dos de cinco ya no es la que se dejó a medias, y sus puntuaciones guardadas
 * no cuadrarían con los pasos que quedan.
 */
export function canResume(saved: SavedProgress, mode: GameMode): boolean {
  if (saved.challengeIds.length === 0) {
    return false;
  }
  const available = new Set(getCatalog(mode).map((item) => item.id));
  return saved.challengeIds.every((id) => available.has(id));
}

function loadChallengeMetadata(
  mode: GameMode,
  challengeId: string,
): ChallengeMetadata | null {
  const metadata = getCatalog(mode).find((item) => item.id === challengeId);
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
  const catalog = getCatalog(mode);
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
    const challenge = loadChallengeMetadata(mode, id);
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
