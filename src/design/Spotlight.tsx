import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type ReactElement,
} from "react";
import {
  Dimensions,
  Modal,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
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
 * ## El agujero, y por qué son doce piezas
 *
 * El hueco no se dibuja: **se deja sin tapar**. La oscuridad son cuatro paños
 * macizos que se reparten todo lo que no es el rectángulo señalado, y los picos
 * que quedarían en las cuatro esquinas —porque el hueco va redondeado, como la
 * fila o la tarjeta que señala— los rellenan cuatro piezas más. El aro de color
 * que lo bordea son sus cuatro lados y los cuatro codos, que viajan dentro de
 * esas mismas piezas de esquina.
 *
 * Doce vistas para un agujero parece mucho, y el motivo es de velocidad, no de
 * dibujo. Las dos formas anteriores de hacerlo eran de una sola pieza y las dos
 * se cayeron por lo mismo: **movían el hueco cambiando la maqueta**.
 *
 *  1. Un `<Path>` de SVG a pantalla completa con regla `evenodd`, recalculando
 *     el atributo `d` en cada fotograma. En un Redmi de 120 Hz costaba 44 ms por
 *     fotograma y dejaba el recorrido en 7 fps.
 *  2. Una sola vista **más grande que la pantalla** con un borde tan grueso como
 *     su desbordamiento: el canto interior de un borde redondeado es un
 *     rectángulo redondeado, y lo de dentro queda sin pintar. Se dibujaba
 *     barato, pero para mover el hueco había que animarle `left`, `top`,
 *     `width`, `height` y `borderWidth`.
 *
 * Y ahí está la trampa: Reanimated solo puede escribir en el hilo de UI las
 * propiedades que **no** afectan a la maqueta. Las que sí —y `width`, `height`,
 * `borderWidth` y `left`/`top` lo son— las aparta y las aplica confirmando el
 * árbol de sombra entero: clonar el árbol, pasar Yoga y generar instrucciones de
 * montaje, sesenta veces por segundo, para una pantalla que tiene doscientas y
 * pico vistas. Ver `PropsLayoutFilter.h` en el propio Reanimated, que es donde
 * está escrita esa lista.
 *
 * Con doce piezas, la maqueta de todas es **fija**, y lo único que se anima es
 * `transform`: desplazar y estirar. Eso Reanimated lo escribe directamente en la
 * vista nativa, sin pasar por React ni por Yoga. El reparto está pensado para
 * que las piezas **encajen sin solaparse**: el paño oscuro es translúcido, así
 * que dos piezas pisándose dejarían una costura más oscura marcando por dónde va
 * la junta. Por eso también se redondean las medidas a píxel físico (`snap`):
 * dos cantos a mitad de píxel dejan una raya clara entre ellos.
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
 *  - **`live`**. El agujero es un agujero de verdad: **lo que está dentro recibe
 *    el toque**, porque los paños oscuros solo cubren lo de fuera y son ellos
 *    los que se comen el dedo.
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
/** Grosor del aro que traza el hueco. */
const RING = 1.5;

/**
 * Lo que miden de fábrica las piezas que se estiran.
 *
 * Un paño que tiene que medir lo que mida el hueco no puede pedirle a la maqueta
 * un alto nuevo en cada fotograma —eso es justo lo que se quiere evitar—, así
 * que nace con un tamaño cualquiera y se escala. Cien es redondo y deja el
 * factor de escala en un número legible cuando hay que depurarlo.
 */
const BASE = 100;

/**
 * Píxeles físicos por punto.
 *
 * Los cantos de dos paños contiguos caen exactamente en la misma coordenada, y
 * si esa coordenada está a mitad de píxel los dos se dibujan a medio cubrir: el
 * resultado es una raya clara justo por donde pasa la junta. Redondear a píxel
 * la hace desaparecer.
 */
const PIXEL = PixelRatio.get();

/** A píxel físico entero. Ver `PIXEL`. */
function snap(value: number): number {
  "worklet";
  return Math.round(value * PIXEL) / PIXEL;
}

/**
 * Cuánto se desbordan los paños por fuera de la pantalla.
 *
 * Cada paño empieza justo en un canto del hueco y tira hacia su lado hasta
 * salirse: con el lado mayor de la pantalla llega de sobra desde cualquier
 * posición del hueco, y así ninguno tiene que saber lo lejos que está del borde.
 *
 * Es del módulo y no del componente porque son medidas de la hoja de estilos, y
 * la aplicación está fijada en vertical: la pantalla no cambia de tamaño. Se
 * mide la pantalla y no la ventana a propósito, que es lo que no depende de si
 * hay barras a la vista.
 */
const DEPTH = Math.max(
  Dimensions.get("screen").width,
  Dimensions.get("screen").height,
);

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
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  /**
   * El alto de la tarjeta, medido. Hace falta para decidir si cabe encima o
   * debajo del hueco, y no se puede estimar: el texto de cada paso ocupa lo que
   * ocupa, y un paso de tres líneas colocado como si fuera de dos se sale de la
   * pantalla justo en el paso más largo.
   *
   * Es un valor compartido y no un estado porque cada paso trae un texto de
   * alto distinto: como estado, medir disparaba un render entero del foco
   * —tarjeta, aro y todas las piezas del agujero— **por cada paso**, y encima
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

  /**
   * El radio del hueco **no** se anima, y es a propósito.
   *
   * De un paso a otro cambia como mucho cuatro puntos —una fila y el botón de
   * ajustes se redondean casi igual—, así que animarlo no se ve. Lo que sí se
   * notaría es lo que costaría: es la medida de las cuatro piezas de esquina, y
   * con un radio en movimiento esas cuatro piezas tendrían que pedir maqueta
   * nueva en cada fotograma. Ver la nota de arriba.
   *
   * Se acota a la mitad del lado más corto porque si no, en un objetivo
   * pequeño, las esquinas se solaparían entre ellas y la junta se vería. Y se
   * redondea a píxel por lo mismo que las demás medidas: es donde acaba la
   * ventanita de la esquina y empieza el lado recto del aro, y con el corte a
   * mitad de píxel ahí quedaba un punto más apagado en el aro.
   */
  const radius = snap(
    Math.min(
      (step?.radius ?? Radius.lg) + PAD / 2,
      (rect.width + PAD * 2) / 2,
      (rect.height + PAD * 2) / 2,
    ),
  );

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
    };

    if (!placed.current) {
      placed.current = true;
      hx.set(to.x);
      hy.set(to.y);
      hw.set(to.w);
      hh.set(to.h);
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
  }, [hh, hw, hx, hy, rect, step]);

  /*
    Los cuatro paños. Arriba y abajo van de lado a lado y solo se desplazan;
    izquierda y derecha ocupan exactamente el alto del hueco, que es lo único
    que hay que estirar. Repartidos así cubren todo lo que no es el hueco sin
    que dos se pisen.
  */
  const paneTop = useAnimatedStyle(() => ({
    transform: [{ translateY: snap(hy.get()) }],
  }));

  const paneBottom = useAnimatedStyle(() => ({
    transform: [{ translateY: snap(hy.get() + hh.get()) }],
  }));

  const paneLeft = useAnimatedStyle(() => {
    const top = snap(hy.get());
    const h = snap(hy.get() + hh.get()) - top;
    return {
      transform: [
        { translateX: snap(hx.get()) },
        { translateY: top + h / 2 - BASE / 2 },
        { scaleY: h / BASE },
      ],
    };
  });

  const paneRight = useAnimatedStyle(() => {
    const top = snap(hy.get());
    const h = snap(hy.get() + hh.get()) - top;
    return {
      transform: [
        { translateX: snap(hx.get() + hw.get()) },
        { translateY: top + h / 2 - BASE / 2 },
        { scaleY: h / BASE },
      ],
    };
  });

  /* Las cuatro esquinas: solo se desplazan, porque miden lo que mide el radio. */
  const cornerTL = useAnimatedStyle(() => ({
    transform: [
      { translateX: snap(hx.get()) },
      { translateY: snap(hy.get()) },
    ],
  }));

  const cornerTR = useAnimatedStyle(() => ({
    transform: [
      { translateX: snap(hx.get() + hw.get()) - radius },
      { translateY: snap(hy.get()) },
    ],
  }));

  const cornerBL = useAnimatedStyle(() => ({
    transform: [
      { translateX: snap(hx.get()) },
      { translateY: snap(hy.get() + hh.get()) - radius },
    ],
  }));

  const cornerBR = useAnimatedStyle(() => ({
    transform: [
      { translateX: snap(hx.get() + hw.get()) - radius },
      { translateY: snap(hy.get() + hh.get()) - radius },
    ],
  }));

  /* Los cuatro lados rectos del aro. Van de codo a codo, así que se estiran. */
  const edgeTop = useAnimatedStyle(() => {
    const left = snap(hx.get());
    const w = Math.max(0, snap(hx.get() + hw.get()) - left - radius * 2);
    return {
      transform: [
        { translateX: left + radius + w / 2 - BASE / 2 },
        { translateY: snap(hy.get()) },
        { scaleX: w / BASE },
      ],
    };
  });

  const edgeBottom = useAnimatedStyle(() => {
    const left = snap(hx.get());
    const w = Math.max(0, snap(hx.get() + hw.get()) - left - radius * 2);
    return {
      transform: [
        { translateX: left + radius + w / 2 - BASE / 2 },
        { translateY: snap(hy.get() + hh.get()) - RING },
        { scaleX: w / BASE },
      ],
    };
  });

  const edgeLeft = useAnimatedStyle(() => {
    const top = snap(hy.get());
    const h = Math.max(0, snap(hy.get() + hh.get()) - top - radius * 2);
    return {
      transform: [
        { translateX: snap(hx.get()) },
        { translateY: top + radius + h / 2 - BASE / 2 },
        { scaleY: h / BASE },
      ],
    };
  });

  const edgeRight = useAnimatedStyle(() => {
    const top = snap(hy.get());
    const h = Math.max(0, snap(hy.get() + hh.get()) - top - radius * 2);
    return {
      transform: [
        { translateX: snap(hx.get() + hw.get()) - RING },
        { translateY: top + radius + h / 2 - BASE / 2 },
        { scaleY: h / BASE },
      ],
    };
  });

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

  /*
    La tarjeta también se coloca con `transform` y no con `top`, por lo mismo
    que el agujero: `top` es una propiedad de maqueta, y aquí se recalcula en
    cuanto llega la medida del texto del paso.

    Y también a píxel entero: `top` lo redondeaba la maqueta por su cuenta, y
    sin redondearlo aquí el canto de color de la tarjeta caía a mitad de píxel
    y se veía medio apagado.
  */
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: snap(placeCard({
          rect,
          cardHeight: cardHeight.get(),
          top: insets.top + EDGE,
          bottom: screenH - insets.bottom - EDGE,
        })),
      },
    ],
  }));

  if (step == null) {
    return null;
  }

  const pigment = colors.spectrum[step.tone];
  /**
   * Los dos colores del agujero, y a la vez lo que necesitan las esquinas.
   *
   * El paño va al 90 % en el propio color y no con `opacity`: la opacidad es de
   * la vista entera, y dos vistas translúcidas que se tocan dejan ver la junta.
   */
  const ink = { shade: `${colors.surface.sunken}e6`, pigment: pigment.pigment };
  const dark = { backgroundColor: ink.shade };
  const lit = { backgroundColor: ink.pigment };
  /** En `live` el dedo se lo comen los paños; en los otros dos, el fondo. */
  const blocking = mode === "live";

  /**
   * Lo que se pinta, igual en los tres modos: la oscuridad con su agujero, el
   * aro y la tarjeta. Lo único que cambia entre modos es **quién se come el
   * dedo**, y eso va aparte, debajo de esto en el árbol.
   */
  const layer = (
    <>
      {/*
        El envoltorio recorta: los paños se salen de la pantalla por los cuatro
        lados a propósito, y sin esto en web se verían colgando del lienzo.
      */}
      <View
        style={styles.veilClip}
        pointerEvents={blocking ? "box-none" : "none"}
      >
        {/* La oscuridad: cuatro paños que se reparten lo que no es el hueco. */}
        <Animated.View
          style={[styles.paneWide, styles.paneTop, dark, paneTop]}
          onStartShouldSetResponder={blocking ? swallow : undefined}
        />
        <Animated.View
          style={[styles.paneWide, styles.paneBottom, dark, paneBottom]}
          onStartShouldSetResponder={blocking ? swallow : undefined}
        />
        <Animated.View
          style={[styles.paneTall, styles.paneLeft, dark, paneLeft]}
          onStartShouldSetResponder={blocking ? swallow : undefined}
        />
        <Animated.View
          style={[styles.paneTall, styles.paneRight, dark, paneRight]}
          onStartShouldSetResponder={blocking ? swallow : undefined}
        />

        {/* Los picos que el paño deja en las esquinas, y los codos del aro. */}
        <Corner at="tl" radius={radius} colors={ink} style={cornerTL} />
        <Corner at="tr" radius={radius} colors={ink} style={cornerTR} />
        <Corner at="bl" radius={radius} colors={ink} style={cornerBL} />
        <Corner at="br" radius={radius} colors={ink} style={cornerBR} />

        {/* Y los cuatro lados rectos del aro, de codo a codo. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.edgeWide, lit, edgeTop]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.edgeWide, lit, edgeBottom]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.edgeTall, lit, edgeLeft]}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.edgeTall, lit, edgeRight]}
        />
      </View>

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
      {mode === "inline" ? backdrop : null}
      {layer}
    </View>
  );
}

/**
 * Una esquina del hueco: el pico que le falta al paño y el codo del aro.
 *
 * Las dos cosas caben en la misma ventanita de `radius × radius` puesta en la
 * esquina del hueco, y por eso van juntas: así la esquina es **una sola pieza
 * que se desplaza**, sin nada que estirar ni que volver a medir.
 *
 * Dentro no se dibuja ninguna curva: se aprovecha que el canto interior de un
 * borde redondeado ya es un arco. El relleno es una vista mucho mayor que la
 * ventanita, colocada de modo que su esquina interior caiga justo donde va la
 * del hueco; lo que asoma por la ventanita es exactamente el pico que sobra. El
 * codo del aro es la misma idea con el canto exterior.
 *
 * La banda del relleno mide lo mismo que el radio y no menos: el punto del pico
 * más lejos del centro del arco está a `radio · √2`, así que con una banda más
 * fina que `0,42 · radio` la punta se quedaría sin pintar.
 */
const Corner = memo(function Corner({
  at,
  radius,
  colors,
  style,
}: {
  at: "tl" | "tr" | "bl" | "br";
  radius: number;
  /** El del paño y el del aro. Ver `ink` en el cuerpo del recorrido. */
  colors: { shade: string; pigment: string };
  style: AnimatedStyle<ViewStyle>;
}): ReactElement {
  const band = radius;
  /** Cuatro veces la esquina: de sobra para que el canto opuesto quede fuera. */
  const fill = (radius + band) * 4;
  const arc = radius * 4;

  const left = at === "tl" || at === "bl";
  const top = at === "tl" || at === "tr";

  return (
    <Animated.View
      pointerEvents="none"
      style={[cornerStyles.clip, { width: radius, height: radius }, style]}
    >
      <View
        style={{
          position: "absolute",
          width: fill,
          height: fill,
          left: left ? -band : radius + band - fill,
          top: top ? -band : radius + band - fill,
          borderWidth: band,
          borderRadius: radius + band,
          borderColor: colors.shade,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: arc,
          height: arc,
          left: left ? 0 : radius - arc,
          top: top ? 0 : radius - arc,
          borderWidth: RING,
          borderRadius: radius,
          borderColor: colors.pigment,
        }}
      />
    </Animated.View>
  );
});

/**
 * La ventanita de la esquina. Lo único que hace es recortar: el tamaño lo pone
 * el radio del paso y el sitio, la animación.
 */
const cornerStyles = StyleSheet.create({
  clip: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
  },
});

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
  top,
  bottom,
}: {
  rect: TargetRect;
  cardHeight: number;
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
   * El envoltorio de la oscuridad, y lo único que se recorta.
   *
   * `fill` no vale: lo comparten dos contenedores más —entre ellos el que lleva
   * la tarjeta— y recortarlos cortaría su sombra contra el borde de la
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
  /*
    Los paños de arriba y abajo van de lado a lado; los de los costados nacen
    con `BASE` de alto y se estiran hasta el alto del hueco. Todos se salen de
    la pantalla por su lado, que es lo que les ahorra saber dónde está el borde.
  */
  paneWide: {
    position: "absolute",
    left: -DEPTH,
    width: DEPTH * 3,
    height: DEPTH,
  },
  paneTop: {
    top: -DEPTH,
  },
  paneBottom: {
    top: 0,
  },
  paneTall: {
    position: "absolute",
    top: 0,
    width: DEPTH,
    height: BASE,
  },
  paneLeft: {
    left: -DEPTH,
  },
  paneRight: {
    left: 0,
  },
  /* Los lados rectos del aro: nacen con `BASE` de largo y se estiran. */
  edgeWide: {
    position: "absolute",
    left: 0,
    top: 0,
    width: BASE,
    height: RING,
  },
  edgeTall: {
    position: "absolute",
    left: 0,
    top: 0,
    width: RING,
    height: BASE,
  },
  card: {
    position: "absolute",
    top: 0,
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
