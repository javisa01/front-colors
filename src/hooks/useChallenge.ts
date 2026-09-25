import { useCallback, useMemo, useState } from "react";

import type {
  ChallengeCategory,
  ChallengeMetadata,
  ChallengeStep,
  GameMode,
  HSVColor,
} from "@/types/challenge";
import { allPlayable, catalogFor } from "@/utils/catalog";
import { hexToHSV, hsvToHex, isUnguessableColor } from "@/utils/color";
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
  TANDA EN REVISIÓN: los logos importados el 2026-09-20 y el 2026-09-23 —eran 32
  y 10, quedan 31 tras retirar los once de riesgo legal del 2026-09-23, ver el
  apartado 1.bis de `PRODUCCION-PENDIENTE.md`— más los símbolos universales
  de `assets/icons/`, que se quedaron en 14 de los 40 importados.

  Mientras esta lista no sea `null`, TODOS los modos reparten solo estos y el
  catálogo de verdad no sale por ningún lado. **Hay que devolverla a `null`
  antes de publicar nada**: es una lista de desarrollo, no una configuración.

  Los marcados abajo cambiaron de color jugable al medirlos por área con
  `npm run measure:assets`, así que son los que más conviene mirar: la
  heurística del generador los había resuelto por número de formas y en varios
  de ellos el color elegido no se veía en pantalla.
*/
/*
  DEV_ONLY: la lista está apagada. Descomenta el bloque de abajo —y comenta el
  `null`— para que TODOS los modos repartan solo esos logos y poder revisarlos
  de uno en uno. Con `null`, el juego reparte el catálogo entero, que es lo que
  tiene que estar publicado.

  Lo que había dentro se conserva tal cual para no perder la tanda que quedó a
  medias: son los logos importados el 2026-09-20 y el 2026-09-23 más los 40
  símbolos universales, estos últimos ya comentados uno a uno.
*/
const DEV_ONLY_LOGOS: string[] | null = null;

// const DEV_ONLY_LOGOS: string[] | null = [
//   // Los cinco que estaban rotos y ya se pintan igual que en el navegador.
//   // "soundcloud",
//   // "outlook",
//   // "access",
//   // "word",
//   // "powerpoint",
//
//   // Los dos que siguen saliendo distintos. La causa está confirmada en los dos
//   // —probada apagándola y volviendo a mirar— y en los dos es de
//   // `react-native-svg`, no del SVG:
//   //
//   // - `flag-lk`: la melena del león sale casi negra. El contorno se dibuja con
//   //   un `<use … stroke="#000" stroke-width="5.6">` DEBAJO del grupo amarillo,
//   //   y react-native-svg le cuela ese trazo también a la copia de arriba, que
//   //   es su hermana y no su hija. Poniéndole `stroke="none"` al
//   //   `<g id="lk-b">` queda idéntico al navegador.
//   //
//   // - `google_sheets`: no se pinta la esquina doblada, el triángulo verde
//   //   claro. El export de Sketch envuelve cada forma en un `<mask>` cuyo
//   //   contenido es un `<use>` a un `<path>` de `<defs>`; esa máscara se queda
//   //   vacía, y en vez de no recortar nada borra la forma entera. Quitando los
//   //   `mask="url(#…)"` —que en este SVG recortan por la silueta de la propia
//   //   forma, o sea que no hacen nada— vuelve a salir bien.
//   "flag-lk",
//   "google_sheets",
// ];

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
// Seis y no cinco: Drive tiene seis pinturas y es justo la clase de logo que
// el modo busca, pero se quedaba fuera por una. Sus seis no son seis colores
// de marca —el azul y el verde vienen cada uno en dos tonos, que son las caras
// sombreadas del triángulo—, así que dos de los seis pasos se aciertan casi
// solos al venir después de su pareja. Aun así entra: un paso fácil dentro de
// un logo que sí es multicolor es mejor trato que dejar el logo fuera. Si
// algún día hay que afinar esto, lo que toca es contar por tono y no por
// pintura; con seis pinturas Drive contaría cuatro colores.
const MULTICOLOR_MAX_COLORS = 6;

/**
 * Los colores de un logo que **sí** se pueden adivinar, con su posición
 * original.
 *
 * El índice hay que conservarlo porque es lo que le dice a `SVGChallenge` qué
 * pintura del dibujo tiene que sustituir: filtrar la lista y perder el índice
 * repintaría el color equivocado.
 *
 * Cockta fue el ejemplo que lo motivó: rojo, amarillo y el contorno negro de
 * las letras. Con el contorno dentro, el modo pedía tres colores y el tercero
 * se acertaba bajando el brillo a cero sin mirar el logo. Sin él eran dos, y
 * como el modo empieza en tres, dejaba de repartirse en multicolor — que es lo
 * correcto: no era un logo multicolor, era uno de dos colores con contorno.
 * (Ese logo se retiró del catálogo el 2026-09-24 por su licencia; la regla que
 * nació con él sigue valiendo para los demás.)
 * Ver `isUnguessableColor`.
 */
function guessableColors(
  challenge: ChallengeMetadata,
): { index: number; color: ChallengeMetadata["colors"][number] }[] {
  const guessable = challenge.colors
    .map((color, index) => ({ index, color }))
    .filter(({ color }) => !isUnguessableColor(color.hsv));

  // Un logo entero en grises no se queda sin nada que jugar: mejor un reto malo
  // que un reto vacío. Es el mismo criterio que usa el generador al construir
  // el catálogo.
  return guessable.length > 0
    ? guessable
    : challenge.colors.map((color, index) => ({ index, color }));
}

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
    const multi = catalog.filter((item) => {
      const count = guessableColors(item).length;
      return count >= MULTICOLOR_MIN_COLORS && count <= MULTICOLOR_MAX_COLORS;
    });
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
      const guessable = guessableColors(challenge);
      guessable.forEach(({ index: colorIndex, color: target }, position) => {
        steps.push({
          challenge,
          colorIndex,
          target,
          colorPosition: position + 1,
          colorCount: guessable.length,
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
