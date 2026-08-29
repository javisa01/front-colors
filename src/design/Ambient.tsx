import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, type ReactElement, type ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { Color, Radius } from "@/design/tokens";

/**
 * Los orbes que respiran detrás de la portada.
 *
 * Cada uno se coloca desbordado por una esquina, así que en pantalla solo entra
 * el trozo que hace de lavado de color. Ese desbordamiento es lo que hace que un
 * círculo de borde duro se lea como una atmósfera: centrado y entero parecería
 * un disco pegado encima.
 *
 * Los tres comparten relojes y van en contrafase —cuando uno sube de opacidad el
 * otro baja, cuando uno flota hacia arriba el otro cae—, que es lo que produce
 * la sensación de balanceo lento. Con un reloj independiente por orbe acabarían
 * sincronizándose y desincronizándose en un ciclo largo y visible.
 *
 * Todo corre en el hilo de UI y el componente no vuelve a renderizarse nunca:
 * ni una sola pasada de React mientras la animación está en marcha. Se desmonta
 * con la portada, así que no queda nada girando cuando el jugador está jugando.
 */

/** Un ciclo completo de latido. */
const GLOW_MS = 2600;
/** Un ciclo completo de flotación, deliberadamente distinto del anterior. */
const FLOAT_MS = 2200;
/**
 * Vaivén horizontal. Es el más largo de los tres a propósito: al no ser múltiplo
 * de los otros dos, la combinación de los tres tarda minutos en repetirse y el
 * fondo nunca llega a leerse como un bucle.
 */
const DRIFT_MS = 6400;

/**
 * Un reloj 0 → 1 → 0 en bucle infinito.
 *
 * ## Por qué `ReduceMotion.Never`
 *
 * Es la razón por la que los orbes se veían **completamente quietos**. Por
 * defecto toda animación de Reanimated usa `ReduceMotion.System`, y si el
 * sistema pide movimiento reducido —en Windows, «Mostrar animaciones» apagado;
 * en el navegador, `prefers-reduced-motion: reduce`— `withRepeat` con
 * repeticiones infinitas y `reverse` tiene un caso especial: como el bucle
 * empieza y acaba en el mismo punto, lo cancela en el primer fotograma y deja el
 * valor clavado en 0. No hay error ni aviso; simplemente no se mueve nunca.
 *
 * Aquí se desactiva ese comportamiento porque estos orbes son un lavado de color
 * de fondo: no hay parpadeo, ni desplazamiento de contenido, ni nada que se
 * pueda perder si no se mira. El resto de la app (pulsaciones, entradas de
 * pantalla) sí sigue respetando el ajuste del sistema.
 *
 * Basta con declararlo en `withRepeat`: el `withTiming` de dentro no fija el
 * suyo, y una animación hija hereda el del padre cuando lo deja sin definir.
 */
function useAmbientClock(durationMs: number): SharedValue<number> {
  const clock = useSharedValue(0);

  useEffect(() => {
    // `reverse: true` en vez de encadenar dos tiempos: la vuelta atrás usa la
    // curva espejada, así que no hay tirón al llegar al extremo del recorrido.
    clock.set(
      withRepeat(
        withTiming(1, {
          duration: durationMs,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
        undefined,
        ReduceMotion.Never,
      ),
    );
  }, [clock, durationMs]);

  return clock;
}

function AmbientOrbsBase(): ReactElement {
  const glow = useAmbientClock(GLOW_MS);
  const float = useAmbientClock(FLOAT_MS);
  const drift = useAmbientClock(DRIFT_MS);

  const violetStyle = useAnimatedStyle(() => ({
    opacity: 0.26 + glow.get() * 0.24,
    transform: [
      { translateX: 14 - drift.get() * 28 },
      { translateY: -float.get() * 18 },
      { scale: 1 + glow.get() * 0.08 },
    ],
  }));

  const roseStyle = useAnimatedStyle(() => ({
    opacity: 0.24 + (1 - glow.get()) * 0.24,
    transform: [
      { translateX: -12 + drift.get() * 24 },
      { translateY: float.get() * 22 },
      { scale: 1 + (1 - glow.get()) * 0.1 },
    ],
  }));

  /**
   * El tercero es una neblina, no un orbe: el doble de grande, a un cuarto de la
   * opacidad de los otros y colgado del reloj lento. Su trabajo es que el centro
   * de la pantalla no quede muerto entre las dos esquinas de color, y por eso se
   * mueve tan despacio que no se percibe como un objeto que viaja.
   */
  const hazeStyle = useAnimatedStyle(() => ({
    opacity: 0.08 + drift.get() * 0.06,
    transform: [
      { translateX: 20 - drift.get() * 40 },
      { translateY: 16 - float.get() * 32 },
      { scale: 1 + drift.get() * 0.06 },
    ],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.orb, styles.topRight, violetStyle]}
      >
        <LinearGradient colors={Color.ambient.violet} style={styles.fill} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.orb, styles.bottomLeft, roseStyle]}
      >
        <LinearGradient colors={Color.ambient.rose} style={styles.fill} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.haze, styles.bottomRight, hazeStyle]}
      >
        <LinearGradient colors={Color.ambient.violet} style={styles.fill} />
      </Animated.View>
    </>
  );
}

export const AmbientOrbs = memo(AmbientOrbsBase);

// ---------------------------------------------------------------------------
// Constelación de resultados
// ---------------------------------------------------------------------------

/**
 * El fondo de las pantallas de resultado de una partida en grupo.
 *
 * Es el mismo idioma que la portada —círculos y los dos tonos ambientales— con
 * otra sintaxis. Los orbes de arriba son tres manchas enormes desbordadas por
 * las esquinas, que es lo que hace falta cuando la pantalla está casi vacía y
 * hay que llenarla de atmósfera. Un marcador no está vacío: lleva tarjetas,
 * filas y cifras, y esa misma mancha se leería como niebla por debajo del texto.
 *
 * Así que aquí los círculos son **dibujo**, no lavado: aros de un píxel y
 * puntos pequeños repartidos por los bordes, donde el contenido no llega. Se
 * ven, se reconocen como los círculos del logo y no le quitan contraste a
 * ninguna cifra, porque no hay relleno debajo de ellas.
 *
 * El movimiento es el mínimo: cada pieza flota por su cuenta con un ciclo
 * distinto y primo de los demás, así que el conjunto no cae nunca en un
 * compás reconocible.
 */
interface ConstellationPiece {
  /** Diámetro en px. */
  size: number;
  /** Posición desde cada borde; solo se declaran los dos que hacen falta. */
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  /** `ring` es un aro hueco; `dot` es un disco lleno. */
  shape: "ring" | "dot";
  cool: boolean;
  opacity: number;
  /** Recorrido vertical total y ciclo completo de ida y vuelta. */
  distance: number;
  durationMs: number;
}

/** Grosor del trazo de un aro. Uno solo: dos grosores distintos en el mismo
 *  fondo se leen como dos capas de profundidad que aquí no existen. */
const RING_WIDTH = 1.5;

/**
 * Todo cae en los bordes a propósito: el contenido de un marcador ocupa la
 * columna central, así que ahí no va nada. Los tres aros grandes salen
 * parcialmente de la pantalla —igual que los orbes de la portada— para que se
 * lean como parte del fondo y no como tres circunferencias dibujadas encima.
 *
 * Las duraciones son deliberadamente primas entre sí; con múltiplos, las seis
 * piezas volverían a alinearse cada pocos segundos y el fondo entero latiría a
 * la vez.
 */
const CONSTELLATION: readonly ConstellationPiece[] = [
  {
    size: 220,
    top: -70,
    left: -80,
    shape: "ring",
    cool: true,
    opacity: 0.5,
    distance: 14,
    durationMs: 5200,
  },
  {
    size: 140,
    top: 120,
    right: -56,
    shape: "ring",
    cool: false,
    opacity: 0.42,
    distance: 18,
    durationMs: 6100,
  },
  {
    size: 300,
    bottom: -140,
    right: -110,
    shape: "ring",
    cool: true,
    opacity: 0.34,
    distance: 22,
    durationMs: 7300,
  },
  {
    size: 12,
    top: 96,
    left: 34,
    shape: "dot",
    cool: true,
    opacity: 0.55,
    distance: 10,
    durationMs: 4300,
  },
  {
    size: 8,
    top: 300,
    right: 42,
    shape: "dot",
    cool: false,
    opacity: 0.5,
    distance: 12,
    durationMs: 5700,
  },
  {
    size: 16,
    bottom: 150,
    left: 22,
    shape: "dot",
    cool: false,
    opacity: 0.4,
    distance: 16,
    durationMs: 6700,
  },
];

function ConstellationCircle({
  piece,
}: {
  piece: ConstellationPiece;
}): ReactElement {
  const clock = useAmbientClock(piece.durationMs);

  // Los dos valores que necesita el worklet se sacan del objeto aquí fuera:
  // dentro de un worklet solo entra lo que se captura, y capturar dos números
  // es más barato que capturar la pieza entera.
  const { distance, opacity } = piece;

  const floatStyle = useAnimatedStyle(() => {
    // El reloj va de 0 a 1; centrarlo reparte el recorrido a ambos lados de la
    // posición de reposo, igual que en `SoftFloat`.
    const phase = clock.get() - 0.5;
    return {
      transform: [
        { translateY: phase * distance },
        // Un tercio del recorrido vertical y en sentido contrario: en diagonal
        // el desplazamiento se percibe como deriva, y en vertical puro como un
        // ascensor.
        { translateX: -phase * distance * 0.35 },
      ],
      // Un margen de opacidad estrecho. Más ancho y los puntos parpadean, que
      // sobre un marcador se lee como un fallo de pintado.
      opacity: opacity * (0.78 + clock.get() * 0.22),
    };
  });

  const color = piece.cool ? Color.ambient.ringCool : Color.ambient.ringWarm;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        {
          width: piece.size,
          height: piece.size,
          top: piece.top,
          bottom: piece.bottom,
          left: piece.left,
          right: piece.right,
        },
        piece.shape === "ring"
          ? { borderWidth: RING_WIDTH, borderColor: color }
          : { backgroundColor: color },
        floatStyle,
      ]}
    />
  );
}

function ResultConstellationBase(): ReactElement {
  return (
    <>
      {CONSTELLATION.map((piece, index) => (
        <ConstellationCircle key={index} piece={piece} />
      ))}
    </>
  );
}

export const ResultConstellation = memo(ResultConstellationBase);

// ---------------------------------------------------------------------------
// Flotación suave
// ---------------------------------------------------------------------------

interface SoftFloatProps {
  children: ReactNode;
  /**
   * Recorrido vertical total, en px. Por encima de 6 deja de leerse como «esto
   * está vivo» y empieza a leerse como «esto se está moviendo», que es justo lo
   * que no queremos en un elemento que además hay que poder leer.
   */
  distance?: number;
  /** Ciclo completo de ida y vuelta. Largo a propósito. */
  durationMs?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Envoltorio que hace flotar muy despacio a lo que tenga dentro.
 *
 * Solo desplaza: no toca la opacidad. Un texto que además parpadea se lee como
 * un fallo de pintado, mientras que uno que sube y baja tres píxeles cada seis
 * segundos no se llega a percibir como animación — se percibe como que la
 * pantalla no está congelada.
 *
 * Reservado para elementos decorativos y no pulsables: mover un objetivo táctil
 * es hacer que el dedo falle.
 */
function SoftFloatBase({
  children,
  distance = 6,
  durationMs = 6000,
  style,
}: SoftFloatProps): ReactElement {
  const clock = useAmbientClock(durationMs);

  const floatStyle = useAnimatedStyle(() => ({
    // El reloj va de 0 a 1; centrarlo reparte el recorrido a ambos lados de la
    // posición de reposo en vez de dejar el elemento siempre por debajo de ella.
    transform: [{ translateY: (clock.get() - 0.5) * distance }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[style, floatStyle]}>
      {children}
    </Animated.View>
  );
}

export const SoftFloat = memo(SoftFloatBase);

const ORB_SIZE = 320;
const HAZE_SIZE = 420;

const styles = StyleSheet.create({
  piece: {
    position: "absolute",
    borderRadius: Radius.pill,
  },
  orb: {
    position: "absolute",
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: Radius.pill,
  },
  haze: {
    position: "absolute",
    width: HAZE_SIZE,
    height: HAZE_SIZE,
    borderRadius: Radius.pill,
  },
  fill: {
    flex: 1,
    borderRadius: Radius.pill,
  },
  topRight: {
    top: -120,
    right: -110,
  },
  bottomLeft: {
    bottom: -140,
    left: -120,
  },
  bottomRight: {
    bottom: -260,
    right: -180,
  },
});
