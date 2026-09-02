import { memo, useCallback, useEffect, useRef, type ReactElement } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Color, Duration, HAIRLINE, Type } from "@/design/tokens";
import { impact } from "@/utils/haptics";
import { playTick } from "@/utils/sound";

/**
 * El dial: la rueda de color como portada.
 *
 * ## La tesis
 *
 * Lo más característico de este juego es su rueda de color. En el resto de la
 * aplicación la rueda es el instrumento con el que se juega; aquí no ilustra la
 * portada, **es** la portada, y se entra por su eje. No hay un botón sobre un
 * fondo: hay un aparato, y su centro es el mando.
 *
 * ## Encendida y apagada
 *
 * El aro tiene dos capas: la de color siempre pintada y una gris **encima**, con
 * la opacidad animada. Apagar la rueda es subir la gris.
 *
 * Es a propósito que sean dos SVG y no un filtro: React Native no tiene filtros
 * CSS, y recalcular 120 cuñas para desaturarlas obligaría a rehacer el SVG en
 * cada fotograma de la transición. Con dos capas fijas, encender es animar una
 * sola opacidad, y eso corre entero en el hilo de UI.
 *
 * El gris no es acromático puro (8 % de saturación): un aro completamente gris
 * se lee como un fallo de carga, y este tiene que leerse como una rueda que
 * **está** apagada, que es otra cosa.
 *
 * ## Por qué el gris significa algo
 *
 * Sin grupos no hay reto que jugar: el reto diario vive dentro de un grupo. Que
 * la rueda esté gris no es un adorno de estado vacío, es literalmente lo que
 * pasa — no hay color hasta que hay con quién. Encenderla es lo que hace el
 * botón, y la animación del toque lo cumple delante de quien lo pulsa.
 *
 * ## El movimiento, sin hover
 *
 * En un móvil no existe pasar el ratón por encima, así que toda la promesa tiene
 * que caber en el toque. Al pulsar el eje pasan tres cosas:
 *
 *  1. **Se enciende.** La capa gris cae a cero en 260 ms, y empieza en
 *     `pressIn`: el color aparece bajo el dedo antes de soltar. Es la respuesta
 *     inmediata que en escritorio daba el hover.
 *  2. **Arranca.** El aro suma media vuelta larga con una curva que frena, así
 *     que parece lanzado a mano y no reproduciendo una animación.
 *  3. **Se abre.** Un halo se expande desde el eje y se apaga.
 *
 * La navegación sale a los 380 ms, con el gesto todavía en marcha: esperar al
 * final haría el toque lento, y salir al instante no dejaría ver nada. Soltar
 * fuera del eje cancela, y la rueda vuelve a su gris.
 */

// ---------------------------------------------------------------------------
// El aro
// ---------------------------------------------------------------------------

/**
 * Mismo método que la rueda del juego (`components/ColorWheel`): como
 * `react-native-svg` no tiene degradado cónico, el disco de tono se compone con
 * cuñas macizas. 120 cuñas son 3° cada una y, con el solapamiento, el escalonado
 * deja de percibirse.
 *
 * Se construyen las dos —color y gris— **a nivel de módulo**, porque son
 * constantes: ni el tamaño ni el estado las cambian. Así montar la portada no
 * cuesta 240 nodos de trabajo en el hilo de JS.
 */
const WEDGE_COUNT = 120;
/** Solapamiento entre cuñas contiguas: sin él, el antialias deja costuras. */
const WEDGE_OVERLAP_DEG = 0.4;

function buildWedges(saturation: number, lightness: number): ReactElement[] {
  const wedges: ReactElement[] = [];
  const step = 360 / WEDGE_COUNT;
  const cx = 50;
  const cy = 50;
  const r = 50;

  for (let index = 0; index < WEDGE_COUNT; index += 1) {
    const from = index * step;
    const to = from + step + WEDGE_OVERLAP_DEG;

    const a1 = (from * Math.PI) / 180;
    const a2 = (to * Math.PI) / 180;

    // Igual que en la rueda del juego: se resta el seno porque el eje Y del SVG
    // crece hacia abajo, y así el tono avanza en sentido antihorario.
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy - r * Math.sin(a2);

    wedges.push(
      <Path
        key={index}
        d={`M${cx} ${cy} L${x1.toFixed(3)} ${y1.toFixed(3)} A${r} ${r} 0 0 0 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`}
        fill={`hsl(${from.toFixed(2)}, ${saturation}%, ${lightness}%)`}
      />,
    );
  }

  return wedges;
}

/**
 * Luminosidad por debajo del 50 % canónico. A plena luz la corona compite con el
 * texto claro del eje y la portada deja de tener un solo sitio donde mirar.
 */
const LIT_WEDGES = buildWedges(72, 42);
/**
 * El apagado va a la misma luminosidad que el encendido, no más abajo. Bajarla
 * —estuvo en 30— convertía la rueda en una mancha negra sin forma: dejaba de
 * leerse como una rueda apagada y pasaba a parecer que no había cargado.
 */
const DIM_WEDGES = buildWedges(9, 40);

/**
 * El agujero central y el desvanecido del borde, en un solo degradado.
 *
 * Los dos extremos son el pozo de la aplicación, así que el aro no tiene ningún
 * canto duro: por dentro se hunde en el hueco donde va el eje, por fuera se
 * disuelve en el fondo. Un aro con borde nítido se leería como un elemento de la
 * interfaz; este es atmósfera con forma de instrumento.
 *
 * Las paradas están medidas contra el eje: opaco hasta el 40 % del radio —justo
 * por dentro del eje— y ya sin tapar a partir del 52 %.
 *
 * El `id` lleva sufijo porque hay dos aros montados a la vez. En nativo cada
 * `Svg` resuelve sus definiciones por su cuenta, pero en web acaban los dos en
 * el mismo documento y el segundo `hole` ganaría para los dos.
 */
const Ring = memo(function Ring({ dim }: { dim: boolean }): ReactElement {
  const id = dim ? "dial-hole-dim" : "dial-hole-lit";
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={Color.surface.sunken} stopOpacity="1" />
          <Stop offset="40%" stopColor={Color.surface.sunken} stopOpacity="1" />
          <Stop offset="52%" stopColor={Color.surface.sunken} stopOpacity="0" />
          <Stop offset="82%" stopColor={Color.surface.sunken} stopOpacity="0" />
          <Stop offset="96%" stopColor={Color.surface.sunken} stopOpacity="1" />
        </RadialGradient>
      </Defs>

      {dim ? DIM_WEDGES : LIT_WEDGES}
      <Circle cx={50} cy={50} r={50} fill={`url(#${id})`} />
    </Svg>
  );
});

// ---------------------------------------------------------------------------
// El dial
// ---------------------------------------------------------------------------

/** Una vuelta completa en reposo. Lentísima a propósito: es fondo, no espera. */
const IDLE_SPIN_MS = 46_000;
/** Grados que suma el arranque del toque. Media vuelta larga. */
const LAUNCH_DEG = 220;
const LAUNCH_MS = 900;
/**
 * Cuándo sale la navegación. Con el gesto a la mitad: antes no se vería nada, y
 * al final el toque se sentiría lento.
 */
const HANDOFF_MS = 380;

/**
 * Proporción del eje respecto al aro. Ver la nota de `hub` en el cuerpo.
 *
 * Se exporta porque la portada necesita saber dónde empieza el eje para no
 * velarlo: el velo del titular se corta justo antes. Ver `VEIL_FADE` en
 * `app/index.tsx`.
 */
export const HUB_RATIO = 0.404;

export interface DialProps {
  /** Diámetro del aro. El eje se dimensiona a partir de él. */
  size: number;
  /** Con color o en gris. Sin nadie con quien jugar, la rueda está apagada. */
  lit: boolean;
  /**
   * Versalitas sobre la acción.
   *
   * Opcional, y con motivo: con la rueda encendida el eje se queda **solo con
   * el verbo**. Ahí no hay nada que explicar —el color es lo que se está
   * viendo alrededor— y las tres líneas competían entre ellas en el único
   * sitio de la portada que hay que pulsar. Apagada sí lleva rótulo, porque
   * entonces el eje no es «jugar»: es «esto se enciende así».
   */
  kicker?: string;
  /** La acción, en grande. Admite dos líneas con `\n`. */
  label: string;
  /** Apunte bajo la acción: intentos, hora, lo que haga falta. */
  note?: string;
  onPress: () => void;
  accessibilityHint?: string;
}

function DialBase({
  size,
  lit,
  kicker,
  label,
  note,
  onPress,
  accessibilityHint,
}: DialProps): ReactElement {
  /**
   * Dos ángulos, no uno.
   *
   * `spin` es la vuelta perpetua y va de 0 a 360 en bucle; `boost` es lo que
   * suma cada toque. Separarlos es lo que permite lanzar la rueda **sin cortar**
   * el giro de fondo: con un solo valor, la animación del toque cancelaría el
   * `withRepeat` y la rueda se quedaría parada al volver a la portada.
   */
  const spin = useSharedValue(0);
  const boost = useSharedValue(0);
  /** Opacidad de la capa gris. 1 apagada, 0 encendida. */
  const dim = useSharedValue(lit ? 0 : 1);
  const hubScale = useSharedValue(1);
  /**
   * Halo del toque: crece y se apaga.
   *
   * En reposo vale **uno**, que es el final del recorrido y por tanto invisible.
   * Empezando en cero, el aro se quedaba dibujado permanentemente alrededor del
   * eje: un segundo anillo que nadie había pedido y que además delataba la
   * animación antes de que ocurriera.
   */
  const burst = useSharedValue(1);

  /**
   * El eje mide poco más de un 40 % del aro. Por debajo, el texto no cabe sin
   * bajar de cuerpo; por encima, el aro se convierte en un marco fino y deja de
   * leerse como una rueda de color.
   */
  const hub = Math.round(size * HUB_RATIO);

  /**
   * El bucle se lanza una sola vez, al montar. Va aquí y no en el cuerpo del
   * componente porque escribir en un valor animado durante el render no está
   * definido: Reanimated puede haber pintado ya ese fotograma.
   */
  useEffect(() => {
    spin.set(
      withRepeat(
        withTiming(360, {
          duration: IDLE_SPIN_MS,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      ),
    );
  }, [spin]);

  /**
   * Encender y apagar cuando el estado cambia de verdad —al volver de crear el
   * primer grupo, por ejemplo—. Encender lleva retardo y va más lento: la
   * portada acaba de aparecer y esto es lo primero que se ve.
   */
  useEffect(() => {
    dim.set(
      withDelay(
        lit ? 240 : 0,
        withTiming(lit ? 0 : 1, { duration: lit ? 700 : Duration.base }),
      ),
    );
  }, [dim, lit]);

  /** El salto a la siguiente pantalla, para poder cancelarlo al desmontar. */
  const handoff = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * La vuelta al gris cuando el toque no llega a nada.
   *
   * Va con retardo porque `onPressOut` se dispara **antes** que `onPress`: sin
   * él, soltar el dedo apagaría la rueda un fotograma antes de que el toque la
   * encienda para siempre, y se vería parpadear justo al navegar. `press`
   * cancela este temporizador, así que solo llega a correr cuando el dedo se
   * ha ido fuera del eje.
   */
  const restore = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (handoff.current != null) {
        clearTimeout(handoff.current);
      }
      if (restore.current != null) {
        clearTimeout(restore.current);
      }
    },
    [],
  );

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.get() + boost.get()}deg` }],
  }));

  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.get() }));

  const hubStyle = useAnimatedStyle(() => ({
    transform: [{ scale: hubScale.get() }],
  }));

  const burstStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - burst.get()),
    transform: [{ scale: 0.98 + burst.get() * 0.55 }],
  }));

  const pressIn = useCallback(() => {
    hubScale.set(
      withTiming(0.955, {
        duration: Duration.instant,
        easing: Easing.out(Easing.quad),
      }),
    );
    // Se enciende ya, con el dedo puesto: es lo que en escritorio hacía el
    // hover, y aquí es la única pista de que pulsar tiene premio.
    dim.set(withTiming(0, { duration: Duration.base }));
  }, [dim, hubScale]);

  const pressOut = useCallback(() => {
    hubScale.set(withTiming(1, { duration: Duration.fast }));
    if (lit) {
      return;
    }
    restore.current = setTimeout(() => {
      restore.current = null;
      dim.set(withTiming(1, { duration: Duration.base }));
    }, 80);
  }, [dim, hubScale, lit]);

  const press = useCallback(() => {
    // El toque ya está en marcha: un segundo golpe apilaría otra pantalla.
    if (handoff.current != null) {
      return;
    }
    if (restore.current != null) {
      clearTimeout(restore.current);
      restore.current = null;
    }

    impact("medium");
    playTick();

    // Lanzada a mano: entra rápida y frena. Con una curva lineal parecería que
    // ha empezado a cargar algo.
    boost.set(
      withTiming(boost.get() + LAUNCH_DEG, {
        duration: LAUNCH_MS,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );

    hubScale.set(
      withSequence(
        withTiming(1.055, { duration: 140, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }),
      ),
    );

    burst.set(0);
    burst.set(
      withTiming(1, {
        duration: 620,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );

    handoff.current = setTimeout(() => {
      handoff.current = null;
      onPress();
    }, HANDOFF_MS);
  }, [boost, burst, hubScale, onPress]);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View style={[styles.layer, ringStyle]} pointerEvents="none">
        <Ring dim={false} />
        <Animated.View style={[styles.layer, dimStyle]}>
          <Ring dim />
        </Animated.View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.burst,
          { width: hub + 26, height: hub + 26, borderRadius: (hub + 26) / 2 },
          burstStyle,
        ]}
      />

      <Animated.View style={hubStyle}>
        <Pressable
          onPress={press}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={[
            styles.hub,
            { width: hub, height: hub, borderRadius: hub / 2 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            kicker != null
              ? `${kicker}. ${label.replace("\n", " ")}`
              : label.replace("\n", " ")
          }
          accessibilityHint={accessibilityHint}
        >
          {kicker != null ? (
            <Text style={[Type.label, styles.kicker]}>{kicker}</Text>
          ) : null}
          <Text style={[Type.title, styles.label]}>{label}</Text>
          {note != null ? (
            <Text style={[Type.metricSmall, styles.note]}>{note}</Text>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

export const Dial = memo(DialBase);

// ---------------------------------------------------------------------------
// El aro suelto
// ---------------------------------------------------------------------------

/**
 * La misma rueda, sin eje y sin toque: solo el aro girando.
 *
 * Existe para la pantalla de cuenta, y no como adorno reutilizable. Al pulsar
 * el eje del dial la rueda **se enciende y arranca**; si la pantalla siguiente
 * no tuviera nada de eso, el gesto se quedaría sin destino y las dos pantallas
 * parecerían de aplicaciones distintas.
 *
 * Así que allí aparece este aro, ya encendido y colocado arriba —donde en la
 * portada estaba abajo—: se lee como que has entrado **dentro** de la rueda.
 * Es la misma pieza, en otro sitio, y eso es lo que cose las dos pantallas.
 *
 * Entra creciendo un poco y frenando, como algo que acaba de llegar y se posa.
 */
function DialRingBase({
  size,
  style,
}: {
  size: number;
  style?: StyleProp<ViewStyle>;
}): ReactElement {
  const spin = useSharedValue(0);
  const land = useSharedValue(0);

  useEffect(() => {
    spin.set(
      withRepeat(
        withTiming(360, {
          duration: IDLE_SPIN_MS,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.System,
        }),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      ),
    );

    land.set(
      withTiming(1, {
        duration: 720,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
  }, [land, spin]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: land.get(),
    transform: [
      { rotate: `${spin.get()}deg` },
      // Llega algo pasada de tamaño y se asienta. Al revés —creciendo hasta su
      // sitio— se leería como un elemento que aparece, no como uno que aterriza.
      { scale: 1.12 - land.get() * 0.12 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ width: size, height: size }, style, ringStyle]}
    >
      <Ring dim={false} />
    </Animated.View>
  );
}

export const DialRing = memo(DialRingBase);

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  layer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  burst: {
    position: "absolute",
    borderWidth: 1,
    borderColor: Color.accent.default,
  },
  hub: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
    backgroundColor: Color.surface.canvas,
    borderWidth: HAIRLINE,
    borderColor: Color.border.default,
    // La sombra hace de foso: separa el eje del aro sin dibujar un segundo
    // borde, que a este tamaño se leería como dos anillos concéntricos.
    shadowColor: "#000000",
    shadowOpacity: 0.75,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  kicker: {
    color: Color.accent.text,
    textAlign: "center",
  },
  label: {
    textAlign: "center",
  },
  note: {
    color: Color.text.muted,
    textAlign: "center",
  },
});
