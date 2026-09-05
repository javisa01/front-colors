import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type ReactElement,
} from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/design/Button";
import { useCoversScreen } from "@/design/motion";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  Duration,
  Motion,
  Radius,
  Space,
  Type,
  type Palette,
  type SpectrumTone,
} from "@/design/tokens";
import { selectionTick } from "@/utils/haptics";
import { playTick } from "@/utils/sound";

/**
 * El foco: un recorrido que va señalando trozos de la pantalla que hay debajo.
 *
 * ## Qué es y qué no
 *
 * No es una pantalla de ayuda: es una **capa por encima de la pantalla real**,
 * que se oscurece entera menos el trozo del que se está hablando. Lo que se
 * explica está debajo, a la vista, en su sitio y con su aspecto de siempre. Un
 * tutorial que enseña capturas o dibujos obliga a traducir después; este señala
 * la cosa.
 *
 * ## El agujero
 *
 * Es **una sola vista**, más grande que la pantalla, con un borde tan grueso
 * como su desbordamiento. El borde de una vista redondeada crece hacia dentro,
 * así que su canto interior es un rectángulo redondeado del tamaño exacto del
 * hueco y lo de dentro queda sin pintar: eso es el agujero.
 *
 * Cuatro rectángulos alrededor del hueco habrían servido, pero dejan esquinas
 * en pico: aquí el hueco tiene el mismo radio que la tarjeta o la fila que está
 * señalando, así que el foco parece recortado a la medida de la cosa y no una
 * ventana puesta encima. Y un `<Path>` de SVG también servía —era lo que había
 * antes— pero costaba 44 ms por fotograma; ver la nota de `veilStyle`.
 *
 * Las cuatro medidas se animan en el hilo de UI, así que pasar de un paso al
 * siguiente es el agujero **desplazándose y cambiando de tamaño**, no dos
 * agujeros distintos apareciendo. Ese movimiento es el que cuenta que lo de
 * antes y lo de ahora son partes de la misma pantalla.
 *
 * ## Sin flecha
 *
 * El vínculo entre el hueco y el texto no es un pico apuntando: es **el color**.
 * El aro del foco y el canto de la tarjeta llevan el mismo pigmento, y ese
 * pigmento es el que la cosa señalada ya tiene en la aplicación —el ámbar de
 * «Juego rápido» es el ámbar de su icono—. En una aplicación de colores, el
 * color puede hacer de flecha; y de paso, la tarjeta queda libre para colocarse
 * donde haya sitio en vez de tener que tocar el hueco.
 *
 * ## Tres formas de plantarse, y por qué
 *
 * `mode` decide dos cosas a la vez: dónde vive la capa y qué deja pasar.
 *
 *  - **`modal`** (por defecto). Va en un `Modal`, que en Android e iOS es una
 *    ventana aparte: se pone por encima de todo sin que a nadie le importe el
 *    orden del árbol, y **nada** de lo que hay debajo se puede pulsar. Es lo que
 *    quiere el recorrido de práctica, porque lo que señala son filas que navegan
 *    a otra pantalla y el recorrido se quedaría a medias en el primer toque.
 *  - **`inline`**. Lo mismo, pero como capa absoluta dentro del árbol en vez de
 *    en una ventana propia. Se usa cuando en el mismo recorrido hay pasos que sí
 *    tienen que dejar pasar el dedo: una ventana no puede, así que en cuanto uno
 *    de los pasos es `live`, todos dejan el `Modal`.
 *  - **`live`**. El agujero es un agujero de verdad: la capa se recorta en
 *    cuatro paños alrededor del hueco y **lo que está dentro recibe el toque**.
 *
 * `live` existe por el recorrido del modo online, donde lo que hay que aprender
 * es la barra de pestañas. Explicar cuatro botones con cuatro tarjetas no enseña
 * a usarlos; abrir uno y que sea el único píxel vivo de la pantalla, sí. Y ahí
 * el toque no rompe nada porque ese recorrido vive **por encima del navegador**:
 * cambiar de pestaña no lo desmonta.
 *
 * En `live` el paño oscuro no avanza al tocarlo, y es deliberado: el paso pide
 * que se pulse una cosa concreta, así que lo apagado tiene que comportarse como
 * apagado. Para salir están el botón del paso y «saltar».
 *
 * ## Quién mide, y cuándo
 *
 * Este componente **no mide nada**: recibe ya medido el rectángulo del paso que
 * toca. Lo mide quien monta el recorrido, y lo hace **justo antes de cada
 * paso**, no todos de una vez al principio.
 *
 * La diferencia no es de estilo, es un fallo que hubo que arreglar. Midiendo
 * los cuatro de golpe hay que ir subiendo la lista para alcanzar los de abajo,
 * y entonces los rectángulos de los primeros pasos quedan referidos a una
 * posición de la lista que ya no es la que se va a ver: el foco acaba señalando
 * a media pantalla de distancia de lo que está explicando.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Un rectángulo medido en coordenadas de ventana. */
export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Lo que dice un paso. Dónde señala va aparte: ver `rect`. */
export interface SpotlightStep {
  /** Radio del hueco. Por defecto, el de una tarjeta. */
  radius?: number;
  /**
   * Pigmento del paso. Es el que ya lleva la cosa señalada en la aplicación, y
   * el que hace de vínculo entre el aro y la tarjeta.
   */
  tone: SpectrumTone;
  title: string;
  body: string;
  /**
   * Lo que dice el botón en **este** paso, en lugar del «Siguiente» de todos.
   *
   * Existe porque hay recorridos en los que el botón no pasa de página: hace la
   * misma cosa que se está señalando —«Ir a Grupos»— y quien avanza el recorrido
   * es llegar allí. Un botón que navega no puede llamarse igual que uno que
   * pasa de paso, o el jugador aprende que «Siguiente» a veces le cambia la
   * pantalla y a veces no.
   */
  action?: string;
}

/** Dónde vive la capa y qué deja pasar. Ver la nota de arriba. */
export type SpotlightMode = "modal" | "inline" | "live";

interface SpotlightProps {
  /** El guion completo: hace falta entero para la tira de progreso. */
  steps: SpotlightStep[];
  /** En cuál se está. */
  index: number;
  /** Dónde señala el paso actual, medido por quien monta el recorrido. */
  rect: TargetRect;
  onNext: () => void;
  onSkip: () => void;
  /** Texto del botón que avanza. */
  nextLabel: string;
  /** Texto del botón que avanza en el último paso. */
  finishLabel: string;
  /** Texto del botón que se salta el recorrido. */
  skipLabel: string;
  /** Por defecto `modal`, que es el comportamiento de siempre. */
  mode?: SpotlightMode;
}

// ---------------------------------------------------------------------------
// Geometría
// ---------------------------------------------------------------------------

/** Aire entre lo señalado y el borde del hueco. */
const PAD = 8;
/** Separación entre el hueco y la tarjeta. */
const GAP = Space.lg;
/** Margen mínimo de la tarjeta contra los bordes de la pantalla. */
const EDGE = Space.xl;



// ---------------------------------------------------------------------------
// El recorrido
// ---------------------------------------------------------------------------

function SpotlightBase({
  steps,
  index,
  rect,
  onNext,
  onSkip,
  nextLabel,
  finishLabel,
  skipLabel,
  mode = "modal",
}: SpotlightProps): ReactElement | null {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  /**
   * El alto de la tarjeta, medido. Hace falta para decidir si cabe encima o
   * debajo del hueco, y no se puede estimar: el texto de cada paso ocupa lo que
   * ocupa, y un paso de tres líneas colocado como si fuera de dos se sale de la
   * pantalla justo en el paso más largo.
   *
   * Es un valor compartido y no un estado porque cada paso trae un texto de
   * alto distinto: como estado, medir disparaba un render entero del foco
   * —tarjeta, aro y el `Path` a pantalla completa— **por cada paso**, y encima
   * el primer fotograma colocaba la tarjeta con el alto del paso anterior y
   * luego saltaba. Así la colocación se recalcula en el hilo de UI en cuanto
   * llega la medida, sin pasar por React.
   */
  const cardHeight = useSharedValue(0);

  /*
    Mientras el foco está puesto, el paño oscuro tapa el 90 % de la pantalla:
    los fondos animados de debajo se siguen pintando sin que se vean. Esto los
    para. Ver `useAmbientActive` en `design/motion`.
  */
  useCoversScreen();

  const step = steps[index];
  const last = index === steps.length - 1;

  const hx = useSharedValue(rect.x);
  const hy = useSharedValue(rect.y);
  const hw = useSharedValue(rect.width);
  const hh = useSharedValue(rect.height);
  const hr = useSharedValue(step?.radius ?? Radius.lg);

  /**
   * El primer paso aparece con el hueco ya puesto; los siguientes lo mueven.
   *
   * Sin esta distinción, el recorrido se abriría con el agujero viajando desde
   * la esquina superior izquierda, que es de donde parte un valor a cero.
   *
   * Es una `ref` y no un estado porque nada de lo que se pinta depende de ella:
   * solo decide si la colocación salta o se anima. Como estado obligaba a un
   * `setState` dentro del efecto y a un render de más que no cambiaba nada.
   */
  const placed = useRef(false);

  useEffect(() => {
    if (step == null) {
      return;
    }

    const to = {
      x: rect.x - PAD,
      y: rect.y - PAD,
      w: rect.width + PAD * 2,
      h: rect.height + PAD * 2,
      r: (step.radius ?? Radius.lg) + PAD / 2,
    };

    if (!placed.current) {
      placed.current = true;
      hx.set(to.x);
      hy.set(to.y);
      hw.set(to.w);
      hh.set(to.h);
      hr.set(to.r);
      return;
    }

    const config = {
      duration: Duration.slow,
      easing: Easing.bezier(...Motion.standard),
      reduceMotion: ReduceMotion.System,
    };
    hx.set(withTiming(to.x, config));
    hy.set(withTiming(to.y, config));
    hw.set(withTiming(to.w, config));
    hh.set(withTiming(to.h, config));
    hr.set(withTiming(to.r, config));
  }, [hh, hr, hw, hx, hy, rect, step]);

  /**
   * El paño oscuro con el agujero, como **un solo borde enorme**.
   *
   * Antes esto era un `<Path>` con regla `evenodd` a pantalla completa cuyo
   * atributo `d` se recalculaba en cada fotograma. Medido en un Redmi de
   * 120 Hz, ese path costaba **44 ms por fotograma** y dejaba el recorrido en
   * 7 fps con el 91 % de los fotogramas perdidos; quitándolo, la misma
   * secuencia bajaba a 9 ms y 3,8 %. La GPU estaba a 2 ms en los dos casos: lo
   * que se comía el tiempo era volver a interpretar la cadena del camino y
   * repintar el dibujo entero en el hilo de UI, sesenta veces por segundo.
   *
   * El truco que lo sustituye no dibuja nada: es una vista **más grande que la
   * pantalla** con un borde igual de grueso que su desbordamiento. El borde de
   * una vista redondeada crece hacia dentro, así que su canto interior es
   * exactamente un rectángulo redondeado del tamaño del hueco —y lo de dentro
   * queda sin pintar—. Todo lo que se anima (posición, tamaño, radio) son
   * propiedades nativas de una vista: Reanimated las escribe en el hilo de UI
   * sin volver a rasterizar nada.
   *
   * El 90 % de opacidad va en el color y no en `opacity`: una vista de cinco
   * mil píxeles de lado con opacidad propia obligaría a Android a componerla
   * en una capa aparte de ese tamaño, que es justo el gasto que se quiere
   * evitar.
   */
  const spill = Math.max(screenW, screenH);

  const veilStyle = useAnimatedStyle(() => ({
    left: hx.get() - spill,
    top: hy.get() - spill,
    width: hw.get() + spill * 2,
    height: hh.get() + spill * 2,
    borderRadius: hr.get() + spill,
    borderWidth: spill,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    left: hx.get(),
    top: hy.get(),
    width: hw.get(),
    height: hh.get(),
    borderRadius: hr.get(),
  }));

  /**
   * Los cuatro paños que rodean al hueco en `live`.
   *
   * Son **invisibles**: la oscuridad la pinta el `Path`, que no recibe toques.
   * Estos solo existen para comerse el dedo en todo lo que no es el hueco, y
   * por eso hay cuatro y no uno: un solo paño a pantalla completa taparía
   * también lo que se está señalando, que es justo lo que hay que dejar libre.
   *
   * Siguen a los mismos valores compartidos que el agujero, así que se mueven
   * con él en el hilo de UI en vez de ir un fotograma por detrás.
   */
  const scrimTop = useAnimatedStyle(() => ({
    left: 0,
    right: 0,
    top: 0,
    height: Math.max(0, hy.get()),
  }));
  const scrimBottom = useAnimatedStyle(() => ({
    left: 0,
    right: 0,
    top: hy.get() + hh.get(),
    bottom: 0,
  }));
  const scrimLeft = useAnimatedStyle(() => ({
    left: 0,
    top: hy.get(),
    height: hh.get(),
    width: Math.max(0, hx.get()),
  }));
  const scrimRight = useAnimatedStyle(() => ({
    left: hx.get() + hw.get(),
    right: 0,
    top: hy.get(),
    height: hh.get(),
  }));

  const advance = useCallback(() => {
    selectionTick();
    playTick();
    onNext();
  }, [onNext]);

  const skip = useCallback(() => {
    selectionTick();
    onSkip();
  }, [onSkip]);

  const measureCard = useCallback(
    (event: LayoutChangeEvent) => {
      cardHeight.set(event.nativeEvent.layout.height);
    },
    [cardHeight],
  );

  const cardStyle = useAnimatedStyle(() => ({
    top: placeCard({
      rect,
      cardHeight: cardHeight.get(),
      screenH,
      top: insets.top + EDGE,
      bottom: screenH - insets.bottom - EDGE,
    }),
  }));

  if (step == null) {
    return null;
  }

  const pigment = colors.spectrum[step.tone];

  /**
   * Lo que se pinta, igual en los tres modos: la oscuridad con su agujero, el
   * aro y la tarjeta. Lo único que cambia entre modos es **quién se come el
   * dedo**, y eso va aparte, debajo de esto en el árbol.
   */
  const layer = (
    <>
      {/*
        El `pointerEvents` va en un `View` aparte y no solo en el paño: en
        modo `live` el agujero tiene que dejar pasar el dedo, y el paño es una
        vista mucho más grande que la pantalla. Envolverlo garantiza que ni él
        ni nada suyo intercepte un toque. Este `View` además recorta: sin
        `overflow: hidden` el paño desborda la pantalla por los cuatro lados.
      */}
      <View style={styles.veilClip} pointerEvents="none">
        <Animated.View
          style={[
            styles.veil,
            { borderColor: `${colors.surface.sunken}e6` },
            veilStyle,
          ]}
        />
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { borderColor: pigment.pigment }, ringStyle]}
      />

      <Animated.View
        style={[styles.card, cardStyle]}
        onLayout={measureCard}
        // La tarjeta no avanza al tocarla: sus botones sí, y un toque en el
        // texto que se está leyendo no debería pasar de paso.
        onStartShouldSetResponder={() => true}
      >
        {/*
          El canto de color: el mismo mecanismo que usa `Card` con `tone`, y
          el mismo pigmento que el aro. Es lo que sustituye a la flecha.
        */}
        <View style={[styles.edge, { backgroundColor: pigment.pigment }]} />

        <Animated.View
          key={index}
          entering={FadeIn.duration(Duration.fast)}
          style={styles.body}
        >
          <Text style={Type.heading}>{step.title}</Text>
          <Text style={[Type.body, styles.text]}>{step.body}</Text>
        </Animated.View>

        {/*
          El progreso es una tira de muestras, una por paso y cada una del
          pigmento de su paso: dice cuántos quedan y de paso adelanta de qué
          color va el siguiente. Los pasos son una secuencia de verdad, así
          que contar aquí sí informa.
        */}
        <View style={styles.strip}>
          {steps.map((entry, position) => (
            <View
              key={entry.title}
              style={[
                styles.tick,
                position === index && styles.tickHere,
                {
                  backgroundColor:
                    position <= index
                      ? colors.spectrum[entry.tone].pigment
                      : colors.border.default,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Button
            label={skipLabel}
            variant="ghost"
            size="md"
            fullWidth={false}
            onPress={skip}
          />
          <Button
            label={step.action ?? (last ? finishLabel : nextLabel)}
            tone={step.tone}
            size="md"
            fullWidth={false}
            onPress={advance}
          />
        </View>
      </Animated.View>
    </>
  );

  /*
    Todo el fondo avanza. Es lo que espera cualquiera que haya visto un
    recorrido así antes, y los botones siguen estando para quien prefiera
    apuntar.

    Va **fuera del árbol de accesibilidad** a propósito. Anunciado como botón,
    un lector de pantalla leería la pantalla entera como un control con dos
    botones dentro, y en web el DOM acababa con un `<button>` dentro de otro.
    Los controles de verdad son los de la tarjeta; esto es un atajo para el
    dedo, y como tal no tiene por qué existir para quien no lo usa.
  */
  const backdrop = (
    <Pressable
      style={styles.fill}
      onPress={advance}
      accessible={false}
      importantForAccessibility="no"
    />
  );

  if (mode === "modal") {
    return (
      <Modal
        visible
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={skip}
      >
        <Pressable
          style={styles.fill}
          onPress={advance}
          accessible={false}
          importantForAccessibility="no"
        >
          {layer}
        </Pressable>
      </Modal>
    );
  }

  return (
    /*
      `box-none` es lo que hace posible el modo `live`: el contenedor ocupa la
      pantalla entera pero no intercepta nada por sí mismo, así que en el hueco
      —donde no hay ningún hijo— el toque cae al control de debajo.
    */
    <View style={styles.fill} pointerEvents="box-none">
      {mode === "inline" ? (
        backdrop
      ) : (
        <>
          <Animated.View
            style={[styles.scrim, scrimTop]}
            onStartShouldSetResponder={swallow}
          />
          <Animated.View
            style={[styles.scrim, scrimBottom]}
            onStartShouldSetResponder={swallow}
          />
          <Animated.View
            style={[styles.scrim, scrimLeft]}
            onStartShouldSetResponder={swallow}
          />
          <Animated.View
            style={[styles.scrim, scrimRight]}
            onStartShouldSetResponder={swallow}
          />
        </>
      )}
      {layer}
    </View>
  );
}

/**
 * Se queda el toque y no hace nada.
 *
 * Es lo que convierte a un paño en apagado de verdad: sin esto, el dedo
 * atravesaría la oscuridad y pulsaría la pestaña que el paso NO está
 * explicando, que es exactamente lo que el recorrido intenta evitar.
 */
function swallow(): boolean {
  return true;
}

/**
 * Encima o debajo del hueco, lo que quepa.
 *
 * La regla es simple y se lee de una vez: se prefiere el lado con más sitio, y
 * si en el elegido no cabe, se prueba el otro. Como la tarjeta no lleva flecha,
 * no tiene que pegarse al hueco: basta con que no lo tape.
 */
function placeCard({
  rect,
  cardHeight,
  screenH,
  top,
  bottom,
}: {
  rect: TargetRect;
  cardHeight: number;
  screenH: number;
  top: number;
  bottom: number;
}): number {
  "worklet";

  const below = rect.y + rect.height + PAD + GAP;
  const above = rect.y - PAD - GAP - cardHeight;
  const roomBelow = bottom - below;
  const roomAbove = above - top;

  const preferBelow = roomBelow >= roomAbove;
  const first = preferBelow ? below : above;
  const second = preferBelow ? above : below;

  const fits = (candidate: number): boolean =>
    candidate >= top && candidate + cardHeight <= bottom;

  const chosen = fits(first) ? first : fits(second) ? second : first;

  // Si no cabe en ninguno de los dos —un hueco enorme en una pantalla corta—,
  // la tarjeta se queda dentro de la pantalla aunque pise el hueco: mejor eso
  // que un texto que no se puede leer porque se ha salido por abajo.
  return Math.max(top, Math.min(chosen, Math.max(top, bottom - cardHeight)));
}

export const Spotlight = memo(SpotlightBase);

const createStyles = (c: Palette) =>
  StyleSheet.create({
  fill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  /**
   * El envoltorio del paño, y lo único que se recorta.
   *
   * `fill` no vale: lo comparten tres contenedores más —entre ellos el que
   * lleva la tarjeta— y recortarlos cortaría su sombra contra el borde de la
   * pantalla.
   */
  veilClip: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
  },
  /** Sin color: la oscuridad la pinta `veil`. Estos solo paran el dedo. */
  scrim: {
    position: "absolute",
  },
  /**
   * El paño oscuro. Todo lo que lo dibuja —posición, tamaño, radio y grosor del
   * borde— llega desde `veilStyle`; aquí solo queda lo que no cambia.
   */
  veil: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  card: {
    position: "absolute",
    left: EDGE,
    right: EDGE,
    borderRadius: Radius.xl,
    backgroundColor: c.surface.elevated,
    borderWidth: 1,
    borderColor: c.border.default,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
  },
  edge: {
    height: 2,
  },
  body: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.xl,
    gap: Space.sm,
  },
  text: {
    color: c.text.secondary,
  },
  strip: {
    flexDirection: "row",
    gap: Space.xs,
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
  },
  tick: {
    height: 3,
    width: 18,
    borderRadius: Radius.pill,
    opacity: 0.45,
  },
  tickHere: {
    width: 30,
    opacity: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
  },
  });
