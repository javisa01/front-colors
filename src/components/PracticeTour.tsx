import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";
import { ScrollView, useWindowDimensions, type View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Spotlight,
  type SpotlightStep,
  type TargetRect,
} from "@/design/Spotlight";
import { Radius, Space, type SpectrumTone } from "@/design/tokens";
import { t, type TranslationKey } from "@/i18n";
import { loadPracticeTourSeen, setPracticeTourSeen } from "@/utils/storage";

/**
 * El recorrido de la pantalla de práctica, la primera vez que se entra.
 *
 * ## Qué explica, y por qué solo esto
 *
 * Cuatro cosas, que son las cuatro que no se deducen mirando: que **hay dos
 * listas y no una**, que una fila **dice lo que pide y guarda tu récord**, que
 * la segunda lista es **para pasarse el móvil**, y dónde se silencia la música.
 * Los ocho modos no se explican de uno en uno a propósito: cada fila ya trae su
 * descripción debajo del título, y repetirla en una tarjeta sería leerle al
 * jugador lo que tiene delante.
 *
 * El tutorial de bienvenida (`app/welcome.tsx`) enseña **cómo se juega**; este
 * enseña **qué hay en esta pantalla**. No se solapan, y por eso son dos.
 *
 * ## Sobre la pantalla de verdad, no sobre una maqueta
 *
 * Cada paso mide con `measureInWindow` el componente real y le pasa el
 * rectángulo al foco. La consecuencia buena es que el recorrido no se queda
 * desfasado cuando la pantalla cambie: si mañana hay un modo más, el hueco
 * crece solo.
 *
 * ## Se mide paso a paso, no todo al principio
 *
 * Y esto es lo importante. La lista no cabe en una pantalla, así que para
 * alcanzar los pasos de abajo hay que subirla. Midiendo los cuatro de una vez
 * al arrancar, los rectángulos de los primeros quedan referidos a una posición
 * de la lista **que ya no es la que se ve** cuando les toca el turno, y el foco
 * acaba señalando media pantalla más allá de lo que está explicando. Pasó, y se
 * veía a la primera.
 *
 * Así que cada paso hace su propia secuencia justo antes de aparecer: subir la
 * lista hasta el objetivo, esperar a que se asiente, medir, y enseñar. El
 * primero, además, espera a que la pantalla termine de entrar.
 *
 * ## El scroll
 *
 * Lleva su propia cuenta del desplazamiento (`offset`) en vez de preguntárselo
 * a la lista, y puede hacerlo por un motivo concreto: mientras el foco está
 * puesto **nadie más scrollea**, porque la capa se come todos los toques. La
 * única forma de que la lista se mueva es que la mueva esto.
 */

/** Un objetivo del recorrido: a qué apunta, de qué color y qué cuenta. */
interface TourTarget {
  key: keyof PracticeTourRefs;
  tone: SpectrumTone;
  /** Radio del hueco, para que se recorte a la forma de lo que señala. */
  radius: number;
  title: TranslationKey;
  body: TranslationKey;
  /**
   * Lo que se interpola en el cuerpo. Hoy solo el nombre de un modo: escribirlo
   * a mano en la cadena del tutorial haría que el día que se renombre el modo,
   * el tutorial siguiera llamándolo como antes, y en un solo idioma de cuatro.
   *
   * Es una función y no un objeto porque esta lista vive a nivel de módulo:
   * un `t()` evaluado aquí se quedaría con el idioma del arranque. Así la
   * traducción se pide cuando se arma el guion, que es en cada render.
   */
  params?: () => Record<string, string>;
}

export interface PracticeTourRefs {
  solo: RefObject<View | null>;
  row: RefObject<View | null>;
  party: RefObject<View | null>;
  settings: RefObject<View | null>;
}

const TARGETS: TourTarget[] = [
  {
    key: "solo",
    tone: "violet",
    radius: Radius.lg,
    title: "tour.solo.title",
    body: "tour.solo.body",
    // El nombre del modo sale del diccionario, no escrito a mano en el texto:
    // así el tutorial no se queda llamándolo como antes si se renombra.
    params: () => ({ mode: t("mode.quick.title") }),
  },
  {
    key: "row",
    tone: "amber",
    radius: Radius.lg,
    title: "tour.row.title",
    body: "tour.row.body",
  },
  {
    key: "party",
    tone: "rose",
    radius: Radius.lg,
    title: "tour.party.title",
    body: "tour.party.body",
  },
  {
    key: "settings",
    tone: "teal",
    // El botón de ajustes es un cuadrado de esquinas suaves; con el radio de
    // una tarjeta, el hueco se le quedaría grande por las esquinas.
    radius: Radius.md,
    title: "tour.settings.title",
    body: "tour.settings.body",
  },
];

/**
 * Cuánto se espera antes de medir el primer paso.
 *
 * Las filas entran escalonadas a 45 ms y son ocho, así que la última acaba
 * pasados unos 315 ms más su propia entrada. Medio segundo deja margen y sigue
 * siendo lo bastante pronto como para leerse como parte de abrir la pantalla y
 * no como algo que aparece más tarde.
 */
const SETTLE_MS = 520;
/** Lo que se espera tras mover la lista, antes de volver a medir. */
const SCROLL_MS = 90;

export function PracticeTour({
  refs,
  scrollRef,
}: {
  refs: PracticeTourRefs;
  scrollRef: RefObject<ScrollView | null>;
}): ReactElement | null {
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  /** Solo se enciende si no se había visto ya. Ver `loadPracticeTourSeen`. */
  const [running, setRunning] = useState(false);

  /** Lo que llevamos subida la lista. Ver la nota de scroll de arriba. */
  const offset = useRef(0);

  const stop = useCallback(() => {
    setRunning(false);
    setRect(null);
    void setPracticeTourSeen(true);
  }, []);

  /**
   * Coloca el foco sobre el objetivo del paso `at`: sube la lista si hace
   * falta, mide, y publica el rectángulo. Si el objetivo no se puede medir
   * —una fila que no está—, salta al siguiente en vez de dejar el recorrido
   * colgado con la pantalla en negro.
   */
  const focusOn = useCallback(
    async (from: number): Promise<void> => {
      // Bucle y no recursión: saltarse un objetivo que no está es seguir
      // buscando en la misma lista, no empezar un recorrido nuevo.
      for (let at = from; at < TARGETS.length; at += 1) {
        const target = TARGETS[at];
        const ref = refs[target.key];

        let measured = await measure(ref);
        if (measured == null) {
          continue;
        }

        const delta = scrollDelta({
          rect: measured,
          top: insets.top + Space.huge,
          bottom: screenH - insets.bottom - Space.huge,
        });

        if (delta !== 0) {
          offset.current = Math.max(0, offset.current + delta);
          scrollRef.current?.scrollTo({ y: offset.current, animated: false });
          await wait(SCROLL_MS);
          measured = (await measure(ref)) ?? measured;
        }

        setIndex(at);
        setRect(measured);
        return;
      }

      // Ninguno de los que quedaban se pudo medir: se acaba aquí en vez de
      // dejar la pantalla en negro esperando un rectángulo que no va a llegar.
      stop();
    },
    [insets.bottom, insets.top, refs, screenH, scrollRef, stop],
  );

  // Arranque: solo la primera vez, y solo cuando la pantalla se ha asentado.
  useEffect(() => {
    let alive = true;

    void (async () => {
      if (await loadPracticeTourSeen()) {
        return;
      }

      await wait(SETTLE_MS);
      if (!alive) {
        return;
      }

      /*
        La lista arranca arriba del todo, que es lo que hace fiable la cuenta
        de `offset` desde el primer paso.
      */
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      offset.current = 0;
      await wait(SCROLL_MS);
      if (!alive) {
        return;
      }

      setRunning(true);
      await focusOn(0);
    })();

    return () => {
      alive = false;
    };
  }, [focusOn, scrollRef]);

  /**
   * El guion, ya traducido.
   *
   * Se arma dentro del componente y no una vez a nivel de módulo: `t()` devuelve
   * la cadena del idioma **activo en el momento de llamarla**, y un guion
   * congelado al cargar el módulo se quedaría en el idioma con el que arrancó
   * la aplicación. Son cuatro objetos; el coste es ninguno.
   */
  const steps: SpotlightStep[] = TARGETS.map((target) => ({
    radius: target.radius,
    tone: target.tone,
    title: t(target.title),
    body: t(target.body, target.params?.()),
  }));

  const next = useCallback(() => {
    if (index >= TARGETS.length - 1) {
      stop();
      return;
    }
    void focusOn(index + 1);
  }, [focusOn, index, stop]);

  if (!running || rect == null) {
    return null;
  }

  return (
    <Spotlight
      steps={steps}
      index={index}
      rect={rect}
      onNext={next}
      onSkip={stop}
      nextLabel={t("tour.next")}
      finishLabel={t("tour.finish")}
      skipLabel={t("tour.skip")}
    />
  );
}

// ---------------------------------------------------------------------------
// Medir y colocar
// ---------------------------------------------------------------------------

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * La posición de un componente en la ventana.
 *
 * `measureInWindow` va por devolución de llamada y no da nada útil cuando el
 * componente no está montado, así que se envuelve en una promesa que puede
 * resolver a `null`. Un objetivo que no está se salta y el recorrido sigue con
 * los que sí: quedarse a medias es peor que enseñar tres pasos en vez de cuatro.
 */
function measure(ref: RefObject<View | null>): Promise<TargetRect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (node == null) {
      resolve(null);
      return;
    }

    node.measureInWindow((x, y, width, height) => {
      if (width === 0 || height === 0) {
        resolve(null);
        return;
      }
      resolve({ x, y, width, height });
    });
  });
}

/**
 * Cuánto hay que mover la lista para que el objetivo entre entero.
 *
 * Positivo baja, negativo sube. Si el objetivo es más alto que el hueco
 * disponible —la lista de cuatro modos en un móvil corto— se alinea por arriba
 * y se acepta que el hueco se salga por abajo: lo importante de una lista está
 * en su principio.
 */
function scrollDelta({
  rect,
  top,
  bottom,
}: {
  rect: TargetRect;
  top: number;
  bottom: number;
}): number {
  if (rect.height > bottom - top) {
    return Math.round(rect.y - top);
  }
  if (rect.y < top) {
    return Math.round(rect.y - top);
  }
  if (rect.y + rect.height > bottom) {
    return Math.round(rect.y + rect.height - bottom);
  }
  return 0;
}
