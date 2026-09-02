import { useRouter, useSegments } from "expo-router";
import type { Href } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { BackHandler, type View } from "react-native";

import {
  Spotlight,
  type SpotlightStep,
  type TargetRect,
} from "@/design/Spotlight";
import { Radius, SECTION_TONE, type SpectrumTone } from "@/design/tokens";
import { t, type TranslationKey } from "@/i18n";
import { loadOnlineTourSeen, setOnlineTourSeen } from "@/utils/storage";

/**
 * El recorrido del modo online: **una vuelta a la barra de pestañas**.
 *
 * ## Qué enseña, y por qué solo esto
 *
 * Que el modo online se conduce desde abajo. Nada más. La primera vez que
 * alguien entra aquí acaba de registrarse y no tiene ningún grupo, así que la
 * pantalla que se encuentra está casi vacía y las cuatro cosas que puede hacer
 * están en una pastilla flotante que, para quien no la ha visto nunca, es
 * decoración. Lo que hay que enseñar no es qué contiene cada pestaña —eso lo
 * dice la pestaña al abrirla—, sino **que la barra es el sitio**.
 *
 * ## Se toca, no se lee
 *
 * Y de ahí la diferencia con el recorrido de práctica, que señala filas y
 * avanza con un botón. Aquí el hueco está **vivo**: en cada paso, la pestaña
 * iluminada es el único píxel de la pantalla que responde. Se toca, la pestaña
 * cambia por debajo, y el recorrido pasa al siguiente. Cuatro toques y la barra
 * está aprendida; cuatro tarjetas explicándola, no.
 *
 * Quien no quiera tocar la barra tiene el botón de la tarjeta, que hace
 * exactamente lo mismo —navegar— en vez de saltarse el paso. Los dos caminos
 * llevan al mismo sitio, y eso es lo que permite que el recorrido no tenga que
 * adivinar por dónde ha entrado el dedo: **avanza cuando la app llega**. Ver el
 * efecto de llegada, más abajo.
 *
 * ## Por qué vive en el layout y no en una pantalla
 *
 * Porque cambia de pantalla mientras corre. Montado dentro de `/online`, el
 * primer toque en «Grupos» lo desmontaría a mitad de la segunda tarjeta. Aquí
 * arriba, colgado del mismo árbol que `<Tabs>` y por encima de él, las cuatro
 * pestañas pasan por debajo sin que el recorrido se entere.
 *
 * Esa posición es también lo que hace seguro dejar el hueco abierto. En el
 * recorrido de práctica no se podía —lo que señala navega a otra pantalla y se
 * llevaría el recorrido por delante—; aquí navegar **es** el paso.
 *
 * ## El orden de la vuelta
 *
 * Grupos, ranking, perfil, hoy. No es el orden de la barra: es el de la
 * urgencia. Sin grupo no hay nada que jugar, así que Grupos va primero aunque
 * sea la segunda pestaña; y se termina en Hoy porque es donde hay que volver
 * mañana, de modo que la vuelta acaba dejando al jugador en casa y no en una
 * esquina de la que tenga que salir por su cuenta.
 *
 * El último paso ya no es una pestaña: es el botón de crear grupo, que es lo
 * único que se puede hacer hoy. La vuelta explica el mando y termina poniendo
 * el dedo sobre la única tecla que hace algo.
 */

// ---------------------------------------------------------------------------
// Anclajes
// ---------------------------------------------------------------------------

/**
 * Las cosas que el recorrido puede señalar.
 *
 * Son nombres y no referencias porque quien las pinta y quien las señala no se
 * conocen: la barra vive en `OnlineTabBar`, el botón de crear grupo en la
 * pantalla de inicio, y el recorrido en el layout. Cada uno registra lo suyo
 * con `useTourAnchor` y el recorrido lo busca por nombre cuando le toca.
 */
export type TourAnchor =
  | "bar"
  | "tab.today"
  | "tab.groups"
  | "tab.ranking"
  | "tab.profile"
  | "firstGroup";

interface TourValue {
  /** Guarda —o borra— el nodo de un anclaje. Lo llama `useTourAnchor`. */
  bind(key: TourAnchor, node: View | null): void;
  /** El nodo de un anclaje, o `null` si eso no está en pantalla. */
  node(key: TourAnchor): View | null;
  /** Arranca el recorrido ahora. Es lo que hace el enlace «ver cómo funciona». */
  start(): void;
  /**
   * Arranca solo si no se ha visto nunca, y solo una vez por sesión.
   *
   * Lo llama la pantalla de inicio cuando comprueba que no hay ningún grupo,
   * que es la condición que define «primera vez». El layout no puede saberlo
   * —no pide grupos— y la marca guardada por sí sola tampoco: diría que sí a
   * quien lleva un mes jugando y acaba de reinstalar.
   */
  startOnce(): void;
  /** Suscribirse a los arranques. Solo lo usa el propio recorrido. */
  onStart(listener: () => void): () => void;
}

/**
 * El valor de reserva: sin provider no se registra nada y no arranca nada.
 *
 * No es defensa por defender. La barra de pestañas se pinta también en las
 * pantallas profundas del online, y podría montarse un día en una prueba sin el
 * layout completo detrás. Que un recorrido que no existe tumbe la navegación
 * entera sería un mal reparto de culpas.
 */
const IDLE: TourValue = {
  bind: () => {},
  node: () => null,
  start: () => {},
  startOnce: () => {},
  onStart: () => () => {},
};

const TourContext = createContext<TourValue>(IDLE);

export function useTour(): TourValue {
  return useContext(TourContext);
}

/**
 * La referencia que registra un nodo como anclaje del recorrido.
 *
 * Devuelve una función estable —`useCallback` sobre la clave— y eso importa:
 * una `ref` de retrollamada nueva en cada render hace que React la desmonte y
 * la vuelva a montar en cada repintado, y la barra se repinta en cada cambio de
 * pestaña.
 */
export function useTourAnchor(key: TourAnchor): (node: View | null) => void {
  const { bind } = useTour();
  return useCallback((node: View | null) => bind(key, node), [bind, key]);
}

/**
 * El registro de anclajes y el interruptor de arranque.
 *
 * Su valor de contexto es **estable para siempre** —un `useMemo` sin
 * dependencias sobre un mapa y un conjunto guardados en `ref`—, y eso es
 * deliberado: este provider envuelve al navegador entero, así que cualquier
 * cambio de estado suyo repintaría las cuatro pestañas. El estado del recorrido
 * —en qué paso va, dónde señala— vive en `OnlineTour`, que es hermano de
 * `<Tabs>` y no su padre.
 */
export function OnlineTourProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const nodes = useRef(new Map<TourAnchor, View>());
  const listeners = useRef(new Set<() => void>());
  /** Ya se ha decidido si el recorrido salía solo. No se vuelve a preguntar. */
  const asked = useRef(false);
  /**
   * Un arranque que llegó antes de que hubiera nadie escuchando.
   *
   * Pasa por el orden en que React ejecuta los efectos: los de las pantallas
   * —hijas de `<Tabs>`— corren antes que los del recorrido, que es su hermano
   * posterior. Sin esto, el arranque automático de la primera vez se perdería
   * en el hueco entre los dos, y el recorrido no saldría nunca aunque la
   * pantalla lo hubiera pedido.
   */
  const pending = useRef(false);

  const value = useMemo<TourValue>(() => {
    const fire = (): void => {
      if (listeners.current.size === 0) {
        pending.current = true;
        return;
      }
      for (const listener of listeners.current) {
        listener();
      }
    };

    return {
      bind(key, node) {
        if (node == null) {
          nodes.current.delete(key);
          return;
        }
        nodes.current.set(key, node);
      },
      node(key) {
        return nodes.current.get(key) ?? null;
      },
      start() {
        asked.current = true;
        fire();
      },
      startOnce() {
        if (asked.current) {
          return;
        }
        asked.current = true;

        void (async () => {
          if (await loadOnlineTourSeen()) {
            return;
          }
          fire();
        })();
      },
      onStart(listener) {
        listeners.current.add(listener);

        // El arranque que se quedó esperando, ahora que hay quien lo atienda.
        if (pending.current) {
          pending.current = false;
          listener();
        }

        return () => {
          listeners.current.delete(listener);
        };
      },
    };
  }, []);

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

// ---------------------------------------------------------------------------
// El guion
// ---------------------------------------------------------------------------

/** Las cuatro raíces con pestaña, por el nombre corto que usa el recorrido. */
type TabRoute = "today" | "groups" | "ranking" | "profile";

interface TourStep {
  anchor: TourAnchor;
  tone: SpectrumTone;
  /** Radio del hueco, para que se recorte a la forma de lo que señala. */
  radius: number;
  title: TranslationKey;
  body: TranslationKey;
  /** Lo que dice el botón. Nunca «Siguiente»: dice lo que va a hacer. */
  action: TranslationKey;
  /** A dónde lleva el paso, si lleva a algún sitio. */
  href?: Href;
  /**
   * La pestaña en la que este paso se da por hecho.
   *
   * Con esto puesto, el botón **solo navega** y quien avanza el recorrido es la
   * llegada. Sin esto, avanza el botón. La distinción evita el salto doble de
   * un paso que avanzaría una vez por el botón y otra por llegar.
   */
  route?: TabRoute;
  /** Si el hueco deja pasar el dedo. Ver `Spotlight`. */
  live: boolean;
}

const STEPS: TourStep[] = [
  {
    anchor: "bar",
    tone: SECTION_TONE.today,
    // La pastilla entera: su forma es una cápsula, y el hueco tiene que
    // recortarse igual o parecería una ventana puesta encima de ella.
    radius: Radius.pill,
    title: "online.tour.bar.title",
    body: "online.tour.bar.body",
    action: "online.tour.bar.action",
    // El único paso apagado. Presenta la barra entera, así que no hay ninguna
    // pestaña concreta que tocar: abrir el hueco aquí sería invitar a pulsar
    // cualquiera de las cuatro y salirse de la vuelta en el paso uno.
    live: false,
  },
  {
    anchor: "tab.groups",
    tone: SECTION_TONE.groups,
    radius: Radius.pill,
    title: "online.tour.groups.title",
    body: "online.tour.groups.body",
    action: "online.tour.groups.action",
    href: "/online/groups",
    route: "groups",
    live: true,
  },
  {
    anchor: "tab.ranking",
    tone: SECTION_TONE.ranking,
    radius: Radius.pill,
    title: "online.tour.ranking.title",
    body: "online.tour.ranking.body",
    action: "online.tour.ranking.action",
    href: "/online/leaderboard",
    route: "ranking",
    live: true,
  },
  {
    anchor: "tab.profile",
    tone: SECTION_TONE.account,
    radius: Radius.pill,
    title: "online.tour.profile.title",
    body: "online.tour.profile.body",
    action: "online.tour.profile.action",
    href: "/online/profile",
    route: "profile",
    live: true,
  },
  {
    anchor: "tab.today",
    tone: SECTION_TONE.today,
    radius: Radius.pill,
    title: "online.tour.today.title",
    body: "online.tour.today.body",
    action: "online.tour.today.action",
    href: "/online",
    route: "today",
    live: true,
  },
  {
    anchor: "firstGroup",
    tone: SECTION_TONE.groups,
    // Un botón, no una pastilla: el radio es el suyo.
    radius: Radius.lg,
    title: "online.tour.create.title",
    body: "online.tour.create.body",
    action: "online.tour.create.action",
    // Directo a la pestaña de crear, que es lo que hace el botón que señala.
    href: { pathname: "/online/groups", params: { action: "create" } },
    // Sin `route` a propósito: es el último paso y termina el recorrido, así
    // que no espera a llegar a ningún sitio para darse por hecho.
    live: true,
  },
];

/**
 * Cuánto se espera antes de medir el primer paso.
 *
 * La barra no entra escalonada como la lista de práctica, pero su pastilla
 * activa **se coloca midiendo** —ver `OnlineTabBar`— y antes de esa primera
 * medida su ancho es cero. Un tercio de segundo va de sobra para eso y sigue
 * leyéndose como parte de abrir la pantalla.
 */
const SETTLE_MS = 340;
/** Lo que se espera tras cambiar de pestaña, antes de medir la siguiente. */
const SWITCH_MS = 220;
/** Segundo intento de medir un anclaje que todavía no estaba montado. */
const RETRY_MS = 140;

// ---------------------------------------------------------------------------
// El recorrido
// ---------------------------------------------------------------------------

export function OnlineTour(): ReactElement | null {
  const { node, onStart } = useTour();
  const router = useRouter();
  const segments = useSegments();

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [running, setRunning] = useState(false);

  /** En qué pestaña está la app ahora mismo. */
  const here = tabOf(segments);

  const stop = useCallback(() => {
    setRunning(false);
    setRect(null);
    void setOnlineTourSeen(true);
  }, []);

  /**
   * Coloca el foco sobre el objetivo del paso `from`.
   *
   * Si el objetivo no se puede medir, salta al siguiente en vez de dejar la
   * pantalla en negro esperando un rectángulo que no va a llegar. Pasa de
   * verdad en el último paso: el botón de crear grupo solo existe cuando no hay
   * ninguno, así que quien repita el recorrido teniendo grupos se lo salta y la
   * vuelta termina en Hoy, que es un final igual de bueno.
   *
   * No hay scroll que mover, a diferencia del recorrido de práctica: cinco de
   * los seis objetivos son la barra, que está anclada al pie, y el sexto está
   * arriba del todo de una pantalla que sin grupos no llega a llenarse.
   */
  const focusOn = useCallback(
    async (from: number): Promise<void> => {
      // Bucle y no recursión: saltarse un objetivo que no está es seguir
      // buscando en el mismo guion, no empezar un recorrido nuevo.
      for (let at = from; at < STEPS.length; at += 1) {
        let measured = await measure(node(STEPS[at].anchor));

        // Un solo reintento. El objetivo puede estar montándose todavía —el
        // botón de crear grupo aparece cuando llega la lista de grupos—, pero
        // si a la segunda tampoco está, es que no está.
        if (measured == null) {
          await wait(RETRY_MS);
          measured = await measure(node(STEPS[at].anchor));
        }

        if (measured == null) {
          continue;
        }

        setIndex(at);
        setRect(measured);
        return;
      }

      stop();
    },
    [node, stop],
  );

  // Arranque. Lo dispara quien decide que toca: la pantalla de inicio la
  // primera vez, o el enlace de «ver cómo funciona».
  useEffect(
    () =>
      onStart(() => {
        void (async () => {
          await wait(SETTLE_MS);
          setIndex(0);
          setRunning(true);
          await focusOn(0);
        })();
      }),
    [focusOn, onStart],
  );

  /**
   * La llegada avanza el recorrido.
   *
   * Este es el mecanismo del que cuelga todo lo demás: un paso no se da por
   * hecho cuando alguien pulsa algo, sino cuando **la app está donde el paso
   * decía**. Da igual si se llegó tocando la pestaña iluminada o el botón de la
   * tarjeta, y daría igual que mañana hubiera una tercera forma de llegar.
   *
   * La espera de `SWITCH_MS` no es para medir —la barra no se mueve— sino para
   * que el salto del hueco no ocurra a la vez que la pastilla activa viaja por
   * debajo: dos movimientos simultáneos en el mismo sitio se leen como uno
   * solo, mal hecho.
   */
  useEffect(() => {
    if (!running) {
      return;
    }

    const step = STEPS[index];
    if (step?.route == null || step.route !== here) {
      return;
    }

    let alive = true;

    void (async () => {
      await wait(SWITCH_MS);
      if (!alive) {
        return;
      }
      if (index >= STEPS.length - 1) {
        stop();
        return;
      }
      await focusOn(index + 1);
    })();

    return () => {
      alive = false;
    };
  }, [focusOn, here, index, running, stop]);

  /*
    El botón de atrás de Android cierra el recorrido en vez de salirse del modo
    online por debajo de él. Sin esto, la capa se quedaría huérfana un instante
    y el jugador acabaría en la portada con el recorrido a medias y sin marcar
    como visto, así que le saldría otra vez al volver a entrar.

    En iOS no existe ese botón y el listener no llega a dispararse; en web,
    `BackHandler` es un apaño sin efecto. En los dos casos queda «saltar».
  */
  useEffect(() => {
    if (!running) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        stop();
        return true;
      },
    );

    return () => subscription.remove();
  }, [running, stop]);

  /**
   * El guion, ya traducido.
   *
   * Se arma en cada render y no una vez a nivel de módulo por el mismo motivo
   * que en el recorrido de práctica: `t()` devuelve la cadena del idioma activo
   * **en el momento de llamarla**, y un guion congelado al cargar el módulo se
   * quedaría en el idioma con el que arrancó la aplicación.
   */
  const steps: SpotlightStep[] = STEPS.map((step) => ({
    radius: step.radius,
    tone: step.tone,
    title: t(step.title),
    body: t(step.body),
    action: t(step.action),
  }));

  /**
   * Lo que hace el botón de la tarjeta.
   *
   * En los pasos que llevan a una pestaña **no avanza**: navega, exactamente
   * igual que la pestaña iluminada, y deja que el recorrido avance solo al
   * llegar. Es lo que hace que el botón y el dedo sean el mismo camino y no dos
   * con reglas distintas.
   */
  const advance = useCallback(() => {
    const step = STEPS[index];
    if (step == null) {
      return;
    }

    if (step.route != null && step.href != null) {
      router.navigate(step.href);
      return;
    }

    if (step.href != null) {
      router.navigate(step.href);
    }

    if (index >= STEPS.length - 1) {
      stop();
      return;
    }

    void focusOn(index + 1);
  }, [focusOn, index, router, stop]);

  if (!running || rect == null) {
    return null;
  }

  return (
    <Spotlight
      steps={steps}
      index={index}
      rect={rect}
      onNext={advance}
      onSkip={stop}
      nextLabel={t("tour.next")}
      finishLabel={t("tour.finish")}
      skipLabel={t("tour.skip")}
      mode={STEPS[index].live ? "live" : "inline"}
    />
  );
}

// ---------------------------------------------------------------------------
// Medir y situar
// ---------------------------------------------------------------------------

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * La posición de un nodo en la ventana.
 *
 * `measureInWindow` va por retrollamada y no devuelve nada útil cuando el
 * componente no está montado, así que se envuelve en una promesa que puede
 * resolver a `null`. Un objetivo de tamaño cero cuenta como ausente: es lo que
 * devuelve una pestaña que todavía no ha pasado por su primer `onLayout`.
 */
function measure(node: View | null): Promise<TargetRect | null> {
  return new Promise((resolve) => {
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
 * En qué pestaña está la app, a partir de la ruta.
 *
 * Se mira el último segmento y no el conjunto porque las pantallas profundas
 * cuelgan de una pestaña sin serlo: `/online/groups/[id]` termina en el
 * identificador del grupo, así que devuelve `null` y el recorrido no da por
 * llegado un paso porque alguien haya abierto un grupo.
 */
function tabOf(segments: string[]): TabRoute | null {
  switch (segments[segments.length - 1]) {
    case "online":
      return "today";
    case "groups":
      return "groups";
    case "leaderboard":
      return "ranking";
    case "profile":
      return "profile";
    default:
      return null;
  }
}
