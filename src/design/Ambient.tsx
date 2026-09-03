import { LinearGradient } from "expo-linear-gradient";
import {
  memo,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  StyleSheet,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, {
  Defs,
  Polygon,
  Stop,
  LinearGradient as SvgGradient,
} from "react-native-svg";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import {
  Color,
  HAIRLINE,
  Radius,
  type SpectrumTone,
} from "@/design/tokens";

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

/**
 * Un halo redondo que se apaga hacia fuera.
 *
 * Es la pieza que hace posible un orbe **sin borde**. Un círculo de relleno
 * macizo hay que sacarlo casi entero de la pantalla para que no se lea como un
 * disco pegado encima; este se puede meter dentro del lienzo y sigue siendo
 * atmósfera.
 *
 * ## Por qué son doce vistas y no un degradado radial
 *
 * Porque un degradado radial de `react-native-svg` **no se veía**, y sin un
 * dispositivo delante no se puede depurar por qué. Doce discos concéntricos con
 * poca opacidad cada uno acumulan hacia el centro y producen la misma caída
 * suave usando solo `View` y `borderRadius`: no depende de SVG, ni de cómo
 * resuelva cada plataforma los porcentajes de un `Defs`, ni de nada que pueda
 * fallar en silencio.
 *
 * Con 0,1 de opacidad por capa, el centro llega a ~0,7 y el borde exterior se
 * queda en 0,1. Sobre un lienzo casi negro la escalera no se percibe, y menos
 * aún con el orbe respirando.
 */
export function SoftGlow({
  color,
  size,
  /** Opacidad del centro, aproximadamente. Hacia el borde siempre cae a cero. */
  intensity = 1,
}: {
  color: string;
  size: number;
  intensity?: number;
}): ReactElement {
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {GLOW_LAYERS.map((fraction, index) => {
        const layer = size * fraction;
        return (
          <View
            key={index}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: (size - layer) / 2,
              left: (size - layer) / 2,
              width: layer,
              height: layer,
              borderRadius: layer / 2,
              backgroundColor: color,
              opacity: 0.1 * intensity,
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * La variante difuminada de los orbes. **Solo para la portada.**
 *
 * Dos manchas grandes y sin borde en diagonal: violeta arriba a la izquierda y
 * magenta abajo a la derecha. La diagonal deja libre el centro, que es donde va
 * el contenido, y las esquinas que quedan vacías son las de la cabecera y el
 * pie.
 *
 * Vive **aparte** de `AmbientOrbs` en vez de sustituirlo: aquel lo comparten
 * seis pantallas, y cambiarlo movía el fondo de toda la aplicación para
 * arreglar una. Comparten los relojes y el vaivén, así que las dos siguen
 * siendo reconociblemente la misma atmósfera.
 */
function BlurAmbientOrbsBase(): ReactElement {
  const glow = useAmbientClock(GLOW_MS);
  const float = useAmbientClock(FLOAT_MS);
  const drift = useAmbientClock(DRIFT_MS);

  /*
    Bastante más opacos que los macizos, y no es contradictorio: al caer a cero
    en el borde, solo el corazón del halo llega a esta opacidad y el resto de la
    mancha queda muy por debajo. Con los valores de `AmbientOrbs` no se veía
    nada.
  */
  const violetStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + glow.get() * 0.22,
    transform: [
      { translateX: 14 - drift.get() * 28 },
      { translateY: -float.get() * 18 },
      { scale: 1 + glow.get() * 0.08 },
    ],
  }));

  const roseStyle = useAnimatedStyle(() => ({
    opacity: 0.46 + (1 - glow.get()) * 0.22,
    transform: [
      { translateX: -12 + drift.get() * 24 },
      { translateY: float.get() * 22 },
      { scale: 1 + (1 - glow.get()) * 0.1 },
    ],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.blurOrb, styles.blurTopLeft, violetStyle]}
      >
        <SoftGlow color={Color.ambient.violet[0]} size={BLUR_ORB_SIZE} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.blurOrb, styles.blurBottomRight, roseStyle]}
      >
        <SoftGlow color={Color.ambient.rose[0]} size={BLUR_ORB_SIZE} />
      </Animated.View>
    </>
  );
}

export const BlurAmbientOrbs = memo(BlurAmbientOrbsBase);

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
// Órbita
// ---------------------------------------------------------------------------

/**
 * El fondo del área online.
 *
 * Tercer miembro de la familia, y el más callado de los tres. La portada tiene
 * manchas desbordadas por las esquinas; los marcadores de una partida en grupo,
 * aros y puntos repartidos por los bordes. Aquí son **anillos concéntricos**:
 * el mismo círculo del logo repetido a tres tamaños alrededor de un único
 * centro, colgado fuera de la esquina superior derecha.
 *
 * Concéntricos y no dispersos porque esta pantalla es un menú largo y con
 * scroll. Compartiendo centro, los tres anillos se leen como **un solo objeto**
 * al que le pasa el contenido por encima; repartidos, serían tres cosas que
 * aparecen y desaparecen conforme se desplaza la lista, y eso sí distrae.
 *
 * Un único reloj para los tres, con el radio como única diferencia: respiran a
 * la vez, como una onda. Es lo contrario que en la constelación, donde cada
 * pieza va por libre justamente para que no se lean como un conjunto.
 */

/** Ciclo completo del pulso. Largo: es un menú, no una celebración. */
const ORBIT_MS = 7600;

/** Diámetros de los tres anillos. El centro es común a los tres. */
const ORBIT_SIZES = [200, 340, 500] as const;

/** Centro compartido, desbordado por la esquina superior derecha. */
const ORBIT_TOP = -150;
const ORBIT_RIGHT = -170;

/**
 * El satélite: un punto lleno posado sobre el anillo intermedio.
 *
 * Es lo que convierte tres circunferencias en una órbita. Sin él los anillos se
 * leen como una diana —tres aros y nada que los recorra—; con un punto encima
 * de uno de ellos, el ojo entiende de golpe que lo que hay dibujado es un
 * trayecto. Va en el intermedio y no en el de fuera para que caiga dentro de la
 * pantalla en un móvil estrecho.
 */
const SATELLITE_SIZE = 10;

/**
 * Cuánto crece un anillo en su pulso. Los de fuera crecen algo más, que es lo
 * que hace que la onda se propague en vez de latir todo a la vez.
 *
 * Es una función y no un número escrito en cada sitio porque el satélite tiene
 * que crecer **exactamente** lo mismo que el anillo en el que se posa: con dos
 * copias del número, la primera vez que se retoque una el punto se despega del
 * trazo y nadie sabrá por qué.
 */
function ringGrowth(index: number): number {
  return 0.02 + index * 0.012;
}

/**
 * Dónde se posa, medido desde el centro común con el convenio de siempre: 0° a
 * la derecha y los grados creciendo en sentido antihorario.
 *
 * El centro está desbordado por la esquina superior derecha, así que el único
 * cuadrante que entra en pantalla es el tercero —abajo y a la izquierda del
 * centro—, y por eso el ángulo cae entre 180° y 270°. Con 150°, que es lo
 * primero que se probó, el punto quedaba 140 puntos por encima del borde
 * superior: invisible.
 */
const SATELLITE_ANGLE = (215 * Math.PI) / 180;

/** En qué anillo se posa. El intermedio: ver `SATELLITE_ANGLE`. */
const SATELLITE_RING_INDEX = 1;

function OrbitSatellite({ clock }: { clock: SharedValue<number> }): ReactElement {
  const ringSize = ORBIT_SIZES[SATELLITE_RING_INDEX];
  const radius = ringSize / 2;
  const cos = Math.cos(SATELLITE_ANGLE);
  const sin = Math.sin(SATELLITE_ANGLE);

  // El centro común, en coordenadas de la esquina superior derecha. Es el mismo
  // cálculo que hace `OrbitRing` para alinear los tres anillos.
  const centerTop = ORBIT_TOP - (ringSize - ORBIT_SIZES[0]) / 2 + radius;
  const centerRight = ORBIT_RIGHT - (ringSize - ORBIT_SIZES[0]) / 2 + radius;

  /** Cuánto se aleja del centro cuando el anillo está en lo alto de su pulso. */
  const reach = radius * ringGrowth(SATELLITE_RING_INDEX);

  const satelliteStyle = useAnimatedStyle(() => {
    // El anillo se ensancha escalando; el punto no puede hacer lo mismo, porque
    // escalar un disco lo agranda sin moverlo del sitio. Para seguir pegado al
    // trazo tiene que recorrer el radio: se desplaza a lo largo de la misma
    // recta que lo une con el centro, y exactamente lo que el anillo crece.
    const grown = reach * clock.get();
    return {
      opacity: 0.3 + clock.get() * 0.35,
      transform: [
        { translateX: cos * grown },
        // El eje vertical de la pantalla va al revés que el de la
        // circunferencia: hacia abajo es positivo.
        { translateY: -sin * grown },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        {
          width: SATELLITE_SIZE,
          height: SATELLITE_SIZE,
          top: centerTop - radius * sin - SATELLITE_SIZE / 2,
          right: centerRight - radius * cos - SATELLITE_SIZE / 2,
          backgroundColor: Color.ambient.ringCool,
        },
        satelliteStyle,
      ]}
    />
  );
}

function AmbientOrbitBase(): ReactElement {
  const clock = useAmbientClock(ORBIT_MS);

  return (
    <>
      {ORBIT_SIZES.map((size, index) => (
        <OrbitRing key={size} size={size} index={index} clock={clock} />
      ))}
      <OrbitSatellite clock={clock} />
    </>
  );
}

function OrbitRing({
  size,
  index,
  clock,
}: {
  size: number;
  index: number;
  clock: SharedValue<number>;
}): ReactElement {
  // El anillo de fuera es el más tenue: si los tres pesaran igual, el conjunto
  // se leería como una diana en lugar de como algo que se desvanece.
  const opacity = 0.34 - index * 0.09;
  const growth = ringGrowth(index);

  const ringStyle = useAnimatedStyle(() => ({
    // Cada anillo va un paso por detrás del anterior, así que el pulso se
    // propaga de dentro hacia fuera en vez de latir todo a la vez.
    opacity: opacity * (0.6 + clock.get() * 0.4),
    transform: [{ scale: 1 + clock.get() * growth }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        {
          width: size,
          height: size,
          // Centro común: al crecer el diámetro, la posición se corrige media
          // diferencia por cada lado. Sin esto los anillos serían concéntricos
          // por la esquina y no por su centro.
          top: ORBIT_TOP - (size - ORBIT_SIZES[0]) / 2,
          right: ORBIT_RIGHT - (size - ORBIT_SIZES[0]) / 2,
          borderWidth: 1,
          borderColor: Color.ambient.ringCool,
        },
        ringStyle,
      ]}
    />
  );
}

export const AmbientOrbit = memo(AmbientOrbitBase);

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

// ---------------------------------------------------------------------------
// Franjas
// ---------------------------------------------------------------------------

/**
 * El fondo de la lista de grupos.
 *
 * Cuarto miembro de la familia y el único que no está hecho de círculos. Los
 * otros tres ya se reparten esa forma —manchas desbordadas en la portada, aros
 * y puntos en un marcador, anillos concéntricos en el menú—, así que un cuarto
 * redondo sería el tercer aro con otra excusa. Aquí son **franjas diagonales**:
 * tres bandas largas y muy tenues que cruzan la pantalla de esquina a esquina.
 *
 * La forma dice algo de la pantalla. Una lista de grupos es una pila de filas
 * paralelas, y unas bandas paralelas por detrás continúan ese ritmo en lugar de
 * pelearse con él; un círculo grande detrás de una lista larga se lee como una
 * mancha que aparece y desaparece al desplazarse.
 *
 * Van a 22 grados y no a 45: inclinadas lo justo para que se note que no son
 * horizontales, sin llegar a competir con la horizontal fuerte de cada fila.
 * Y solo hay tres, muy separadas, porque a partir de cuatro dejan de ser
 * atmósfera y empiezan a ser una textura de rayas.
 */

/** Ciclo del deslizamiento. Larguísimo: el movimiento no debe percibirse. */
const BAND_MS = 9200;

interface BandSpec {
  /** Distancia desde el borde superior al centro de la banda. */
  top: number;
  /** Grosor. La de en medio es la ancha; las otras dos, hilos. */
  height: number;
  /** El par frío o el cálido. */
  cool: boolean;
  opacity: number;
  /** Recorrido horizontal total del vaivén. */
  drift: number;
}

/**
 * Tres bandas, repartidas por el alto de la pantalla.
 *
 * La ancha va arriba, donde está la cabecera y no hay filas todavía; las dos
 * finas caen sobre la lista, que es donde el contenido manda y el fondo tiene
 * que desaparecer.
 */
const BANDS: BandSpec[] = [
  { top: 90, height: 200, cool: true, opacity: 0.2, drift: 34 },
  { top: 380, height: 3, cool: false, opacity: 0.32, drift: -22 },
  { top: 620, height: 120, cool: false, opacity: 0.14, drift: 26 },
];

/** Inclinación de las tres. Ver la nota de arriba. */
const BAND_ANGLE = "22deg";

function AmbientBandsBase(): ReactElement {
  const clock = useAmbientClock(BAND_MS);

  return (
    <>
      {BANDS.map((band, index) => (
        <Band key={index} spec={band} clock={clock} />
      ))}
    </>
  );
}

function Band({
  spec,
  clock,
}: {
  spec: BandSpec;
  clock: SharedValue<number>;
}): ReactElement {
  const bandStyle = useAnimatedStyle(() => ({
    // Centrado en el recorrido: la banda se mueve a los dos lados de su
    // posición de reposo en vez de quedarse siempre desplazada a un lado.
    transform: [
      { translateX: (clock.get() - 0.5) * spec.drift },
      { rotate: BAND_ANGLE },
    ],
    opacity: spec.opacity * (0.65 + clock.get() * 0.35),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.band,
        { top: spec.top, height: spec.height },
        bandStyle,
      ]}
    >
      {/*
        El degradado va de transparente a color y otra vez a transparente: es
        lo que hace que la banda se desvanezca por los dos extremos en lugar de
        cortarse a ras del borde de la pantalla, que es lo que la delataría como
        un rectángulo girado.
      */}
      <LinearGradient
        colors={[
          "transparent",
          spec.cool ? Color.ambient.ringCool : Color.ambient.ringWarm,
          "transparent",
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.fill}
      />
    </Animated.View>
  );
}

export const AmbientBands = memo(AmbientBandsBase);

// ---------------------------------------------------------------------------
// Foco
// ---------------------------------------------------------------------------

/**
 * El fondo del perfil.
 *
 * Quinto miembro de la familia. La regla de la familia es que **cada pantalla
 * tiene su forma**, y que esa forma dice algo de la pantalla: manchas
 * desbordadas en la portada, aros y puntos en un marcador, anillos concéntricos
 * en un menú, franjas paralelas bajo una lista. Aquí es un **haz de luz** que
 * baja desde arriba y se abre.
 *
 * El motivo es que el perfil es la única pantalla de la aplicación que va de
 * **una** persona. Las demás enseñan retos, grupos o clasificaciones —cosas en
 * plural, y por eso sus fondos son repeticiones—; esta enseña a quien la está
 * mirando, así que su fondo es lo que se le hace a alguien a quien se quiere
 * mirar: apuntarle un foco. La ficha de identidad cae justo dentro del cono, y
 * eso no es casualidad — el haz está colocado para iluminarla.
 *
 * Es el primero de la familia dibujado con SVG y no con vistas. Un cono no es un
 * rectángulo ni un círculo, así que con vistas habría que fingirlo con dos
 * degradados cruzados; con un polígono es la forma de verdad, y encima permite
 * que el degradado siga el eje del haz en lugar del de la pantalla.
 */

/** Un ciclo completo del latido del haz. Lento, como todos los de la familia. */
const BEAM_MS = 8200;

/** Vaivén del haz. El más largo: es un foco que oscila, no que barre. */
const SWAY_MS = 11_000;

/**
 * Geometría del cono, en porcentaje del cuadro.
 *
 * El vértice no llega al borde de arriba: se queda un poco por encima del marco
 * y desbordado, para que no se vea el punto exacto del que sale la luz. Un foco
 * con origen visible se lee como un triángulo dibujado.
 */
const BEAM = {
  /** Mitad del ancho del vértice. No es un punto: un haz real tiene boca. */
  apexHalf: 6,
  /** Mitad del ancho de la base. */
  baseHalf: 62,
  /** Centro horizontal del haz. Descentrado a la izquierda, donde va el avatar. */
  center: 38,
  /** Dónde acaba el cono, en porcentaje del alto. */
  bottom: 78,
} as const;

/**
 * Amplitud total del balanceo, en grados.
 *
 * Con el eje clavado en el vértice, el vértice no se mueve **nada** y todo el
 * recorrido se lo lleva la base: a 10 grados repartidos, los vértices de abajo
 * barren casi un tercio del ancho de la pantalla, que es lo que hace que se lea
 * como un foco que busca algo. Los 3,2 grados de la primera versión pivotaban
 * además a media altura, así que el haz entero se desplazaba de lado en bloque
 * y no se percibía como un balancín, sino como un temblor.
 */
const SWING_DEG = 10;

/**
 * A qué altura del haz queda el centro del charco, en tanto por uno del alto.
 *
 * Hace falta para que el charco **acompañe** al haz: la luz y el sitio donde
 * cae no pueden ir cada una por su lado, o el charco se lee como una mancha
 * suelta que casualmente está debajo. Con la distancia al eje y el ángulo sale
 * el desplazamiento exacto, así que los dos se mueven como una sola cosa.
 */
const POOL_DEPTH = 0.42;

function AmbientSpotlightBase(): ReactElement {
  const beat = useAmbientClock(BEAM_MS);
  const sway = useAmbientClock(SWAY_MS);

  /**
   * El alto del haz, medido.
   *
   * El eje tiene que caer en el **vértice**, y el vértice está en el borde de
   * arriba de esta vista. React Native gira siempre alrededor del centro, así
   * que para mover el eje hay que saber cuánto hay del centro al borde — y eso
   * es media altura, que depende del teléfono. Sin medir habría que escribir un
   * número a ojo y el eje caería en otro sitio en cada pantalla.
   */
  const [height, setHeight] = useState(0);
  const pivot = height / 2;

  const onLayout = (event: LayoutChangeEvent): void => {
    const next = event.nativeEvent.layout.height;
    // `onLayout` se dispara en cada repintado: sin la comparación, un
    // `setState` incondicional aquí es un bucle de renders.
    setHeight((previous) => (Math.abs(previous - next) < 1 ? previous : next));
  };

  const beamStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + beat.get() * 0.14,
    transform: [
      // El eje, en el vértice. Se sube el contenido media altura —con lo que el
      // vértice queda sobre el centro, que es donde gira—, se gira, y se
      // devuelve. Mientras no haya medida, `pivot` es 0 y esto es un giro
      // normal alrededor del centro: se ve un fotograma, no molesta.
      { translateY: -pivot },
      { rotate: `${(sway.get() - 0.5) * SWING_DEG}deg` },
      { translateY: pivot },
    ],
  }));

  /**
   * El charco: la elipse muy tenue donde el haz toca el suelo.
   *
   * Sin ella el cono se queda cortado a media pantalla y se lee como un
   * triángulo; con ella, la luz llega a algún sitio. El latido va en contrafase
   * —cuando el haz se abre, el charco se apaga—, que es lo que hace que el
   * conjunto respire en vez de parpadear, pero el desplazamiento lateral va en
   * fase con el haz, porque es el mismo movimiento.
   */
  const poolStyle = useAnimatedStyle(() => {
    const radians = ((sway.get() - 0.5) * SWING_DEG * Math.PI) / 180;
    return {
      opacity: 0.1 + (1 - beat.get()) * 0.08,
      transform: [
        // Cuánto se ha corrido la luz a esta altura: cateto opuesto de un
        // triángulo cuyo vértice es el eje y cuya altura es la del charco.
        { translateX: height * POOL_DEPTH * Math.tan(radians) },
        { scaleX: 1 + beat.get() * 0.06 },
      ],
    };
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        onLayout={onLayout}
        style={[styles.beam, beamStyle]}
      >
        {/*
          `preserveAspectRatio="none"` es obligatorio aquí. El `viewBox` es
          cuadrado y el contenedor es la pantalla entera: con el ajuste por
          defecto, el SVG encaja el cuadrado dentro del alto y centra lo que
          sobra, así que el haz se quedaba encogido en una banda a media
          pantalla en vez de recorrerla. Estirando, las coordenadas del polígono
          pasan a ser porcentajes del cuadro, que es como están escritas.
        */}
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <Defs>
            <SvgGradient id="beamFade" x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0"
                stopColor={Color.ambient.ringCool}
                stopOpacity="0.9"
              />
              <Stop
                offset="1"
                stopColor={Color.ambient.ringCool}
                stopOpacity="0"
              />
            </SvgGradient>
          </Defs>
          <Polygon
            points={[
              `${BEAM.center - BEAM.apexHalf},0`,
              `${BEAM.center + BEAM.apexHalf},0`,
              `${BEAM.center + BEAM.baseHalf},${BEAM.bottom}`,
              `${BEAM.center - BEAM.baseHalf},${BEAM.bottom}`,
            ].join(" ")}
            fill="url(#beamFade)"
          />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.pool, poolStyle]}>
        <LinearGradient
          colors={["transparent", Color.ambient.ringCool, "transparent"]}
          style={styles.fill}
        />
      </Animated.View>
    </>
  );
}

export const AmbientSpotlight = memo(AmbientSpotlightBase);

// ---------------------------------------------------------------------------
// Ascenso
// ---------------------------------------------------------------------------

/**
 * El fondo del ranking.
 *
 * Sexto y último de la familia: tres **columnas** que suben desde el borde
 * inferior, y sus alturas son las del podio —la del medio la más alta, la de la
 * izquierda intermedia, la de la derecha la más baja—. Es la única forma de la
 * familia que no es atmósfera pura: es el objeto del que va la pantalla,
 * abstraído hasta que deja de leerse como un diagrama.
 *
 * Que las alturas sigan al podio y no vayan al azar es lo que separa esto de
 * poner tres barras bonitas: quien mira una clasificación está buscando un
 * orden, y el fondo repite ese orden sin decir nada.
 *
 * Los tonos salen de `Color.podium` —oro, plata y bronce—, que ya existían para
 * marcar los tres primeros puestos de la lista. Reutilizarlos en vez de inventar
 * tres tonos nuevos hace que el fondo y las filas hablen del mismo podio, y de
 * paso es la única parte de la familia donde los colores **no** están a la misma
 * luminosidad: el oro pesa más que el bronce, que es justo la información que
 * llevan.
 */

/** Ciclo de la respiración de las columnas. */
const ASCENT_MS = 8800;

interface ColumnSpec {
  /** Alto en porcentaje de la pantalla. Las tres alturas son las del podio. */
  height: number;
  /** Posición del centro, en porcentaje del ancho. */
  center: number;
  color: string;
  opacity: number;
  /** Retardo relativo dentro del mismo reloj: ver `AscentColumn`. */
  phase: number;
}

const COLUMNS: ColumnSpec[] = [
  // Plata a la izquierda, oro en el centro, bronce a la derecha: el orden en el
  // que se colocan de verdad tres personas en un podio.
  { height: 46, center: 22, color: Color.podium.silver.text, opacity: 0.1, phase: 0.35 },
  { height: 68, center: 50, color: Color.podium.gold.text, opacity: 0.16, phase: 0 },
  { height: 34, center: 79, color: Color.podium.bronze.text, opacity: 0.11, phase: 0.7 },
];

/** Ancho de una columna, en porcentaje del ancho de la pantalla. */
const COLUMN_WIDTH = 30;

function AmbientAscentBase(): ReactElement {
  const clock = useAmbientClock(ASCENT_MS);

  return (
    <>
      {COLUMNS.map((column, index) => (
        <AscentColumn key={index} spec={column} clock={clock} />
      ))}
    </>
  );
}

function AscentColumn({
  spec,
  clock,
}: {
  spec: ColumnSpec;
  clock: SharedValue<number>;
}): ReactElement {
  const columnStyle = useAnimatedStyle(() => {
    /**
     * Un solo reloj para las tres, desfasadas.
     *
     * Con un reloj por columna acabarían sincronizándose y desincronizándose en
     * un ciclo largo y visible —el mismo motivo por el que los orbes de la
     * portada comparten los suyos—. Desplazar la fase y devolver el valor al
     * rango con un triángulo da tres respiraciones distintas de un solo
     * temporizador, y encima el conjunto sube y baja como una onda que recorre
     * el podio en vez de latir en bloque.
     */
    const shifted = (clock.get() + spec.phase) % 1;
    const wave = shifted < 0.5 ? shifted * 2 : (1 - shifted) * 2;

    return {
      opacity: spec.opacity * (0.55 + wave * 0.45),
      // Se desplaza, no se escala. Escalando en vertical una columna anclada
      // abajo, el borde inferior se despega del borde de la pantalla y aparece
      // una franja de lienzo bajo ella en cada respiración.
      transform: [{ translateY: 4 - wave * 8 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.column,
        {
          width: `${COLUMN_WIDTH}%`,
          height: `${spec.height}%`,
          left: `${spec.center - COLUMN_WIDTH / 2}%`,
        },
        columnStyle,
      ]}
    >
      {/*
        El degradado va de transparente arriba a color abajo: la columna nace
        del borde inferior y se desvanece hacia el contenido, así que nunca hay
        un canto duro cruzando el texto de una fila.
      */}
      <LinearGradient
        colors={["transparent", spec.color]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.columnFill}
      />
    </Animated.View>
  );
}

export const AmbientAscent = memo(AmbientAscentBase);

// ---------------------------------------------------------------------------
// El corro
// ---------------------------------------------------------------------------

/**
 * El fondo de la pantalla de amigos: **círculos que se buscan**.
 *
 * Antes usaba los orbes de la portada, y ese era el problema: los orbes son la
 * forma de «la aplicación» —salen en el menú offline y en el hub— y aquí
 * dejaban la pantalla sin identidad, como si fuese una sub-pantalla de otra
 * cosa. Amigos es un destino con su propio contenido, y en esta familia cada
 * destino tiene su forma.
 *
 * La suya son tres aros grandes solapándose. No es decoración con forma de
 * círculo: un diagrama de dos conjuntos que se cortan es la manera más antigua
 * que hay de dibujar «esto que tenemos en común», y de eso va exactamente la
 * pantalla — buscar a alguien, cruzar una solicitud, quedar en la misma lista.
 *
 * ## Por qué se acercan y se separan
 *
 * Es el único movimiento, y significa: los aros se aproximan hasta solaparse
 * más y vuelven a abrirse, muy despacio, en un ciclo de dieciocho segundos. Un
 * latido de opacidad —lo que hacen los orbes— habría sido respirar por
 * respirar; aquí lo que se mueve es la **distancia**, que es el dato del que
 * habla la pantalla.
 *
 * Solo contorno y desbordados por su borde, como el resto de la familia: a
 * este tamaño un aro macizo sería un objeto y no atmósfera, y uno entero
 * dentro de la pantalla se leería como un elemento de la interfaz.
 */

/** Un acercamiento completo, ida y vuelta. Lentísimo: es fondo, no espera. */
const CIRCLE_MS = 18_000;

interface CircleSpec {
  size: number;
  top: DimensionValue;
  /** Posición en reposo, desde el borde izquierdo. */
  left: number;
  /**
   * Cuánto se desplaza en horizontal durante el ciclo. Con signos opuestos
   * entre vecinos, que es lo que hace que se busquen en vez de deslizarse
   * todos hacia el mismo lado.
   */
  drift: number;
  cool: boolean;
  opacity: number;
}

/**
 * Tres, y no dos.
 *
 * Con dos el dibujo es un diagrama de Venn de manual y se lee como un icono;
 * el tercero rompe la simetría y lo devuelve a ser un fondo. Los tamaños son
 * desiguales por lo mismo que en el resto de la familia: tres iguales serían
 * un patrón, y un patrón es papel pintado.
 */
const CIRCLES: CircleSpec[] = [
  // El grande, arriba a la izquierda y desbordado por los dos bordes: es el
  // que cae detrás del aire de la cabecera, antes del campo de búsqueda.
  { size: 300, top: -104, left: -128, drift: 26, cool: true, opacity: 0.3 },
  // Su pareja, cortándolo por la derecha. Va en sentido contrario, así que la
  // zona común crece y mengua.
  { size: 244, top: -46, left: 118, drift: -30, cool: false, opacity: 0.26 },
  // El tercero, abajo y a la izquierda, detrás de la lista de amigos. Más
  // tenue: ahí el contenido es denso y el fondo tiene que pesar menos.
  { size: 268, top: "62%", left: -96, drift: 20, cool: true, opacity: 0.2 },
];

function AmbientCirclesBase(): ReactElement {
  const clock = useAmbientClock(CIRCLE_MS);

  return (
    <>
      {CIRCLES.map((circle, index) => (
        <Circle key={index} spec={circle} clock={clock} />
      ))}
    </>
  );
}

function Circle({
  spec,
  clock,
}: {
  spec: CircleSpec;
  clock: SharedValue<number>;
}): ReactElement {
  const circleStyle = useAnimatedStyle(() => ({
    // El reloj va de 0 a 1 y vuelve, así que basta multiplicar: el aro sale de
    // su sitio, llega al tope y regresa sin ningún tirón en los extremos.
    transform: [{ translateX: spec.drift * clock.get() }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.circle,
        {
          width: spec.size,
          height: spec.size,
          top: spec.top,
          left: spec.left,
          borderColor: spec.cool
            ? Color.ambient.ringCool
            : Color.ambient.ringWarm,
          opacity: spec.opacity,
        },
        circleStyle,
      ]}
    />
  );
}

export const AmbientCircles = memo(AmbientCirclesBase);

// ---------------------------------------------------------------------------
// Trama
// ---------------------------------------------------------------------------

/**
 * El fondo de un grupo: su ficha y sus ajustes.
 *
 * Séptimo de la familia, y el primero **rectilíneo**. Los otros seis se
 * reparten curvas y diagonales —manchas, aros, anillos, franjas, un cono,
 * columnas—, así que una retícula es la única forma que quedaba sin usar, y
 * además es la que toca: un grupo es una temporada, y una temporada es una
 * **cuadrícula de días**.
 *
 * No es un calendario de verdad y no debe parecerlo: no se cuenta, no se
 * corresponde con nada y no cambia con tus datos. Es la *forma* de una
 * temporada, no su contenido — igual que las columnas del ranking tienen las
 * alturas de un podio sin ser el podio de nadie.
 *
 * La ficha y los ajustes comparten fondo a propósito. Son la misma cosa vista
 * de dos maneras —el grupo y las tuercas del grupo—, y darles fondos distintos
 * diría que son sitios distintos.
 *
 * ## Por qué NO se mueve
 *
 * La primera versión desplazaba y hacía latir la retícula entera, y daba
 * tirones. No era el temporizador: es que **una forma pequeña y de borde duro
 * no puede moverse despacio**. Dieciséis píxeles repartidos en casi diez
 * segundos son tres centésimas de píxel por fotograma, y como el render cuadra
 * a píxeles físicos, cada cuadrado se queda quieto un rato y luego salta un
 * píxel entero. Los demás fondos de la familia no lo sufren porque son manchas
 * enormes y difusas, donde ese mismo salto es invisible. Con el latido pasaba
 * algo parecido en el otro eje: sobre un color oscuro, mover la opacidad de una
 * forma pequeña la hace escalonarse en vez de desvanecerse.
 *
 * Y por encima de lo técnico está lo que significa: **un calendario no se
 * mueve**. Los otros seis fondos son atmósfera, y la atmósfera se mueve; este
 * es una estructura, y una estructura que se bambolea se lee como estropeada,
 * no como viva. La ficha del grupo ya tiene su elemento en marcha —el borde de
 * aurora de la tarjeta del reto—, que además es el que hay que mirar.
 *
 * ## De dónde sale la vida, entonces
 *
 * De la composición, no del movimiento. Cuatro grupos de celdas repartidos por la
 * pantalla y a escalas distintas, cada uno con su densidad, y **tres estados de
 * la misma marca**: relleno tenue para un día cualquiera, relleno cálido para
 * uno jugado, y contorno para uno que aún no ha llegado. Es la misma idea que
 * en el resto de la app —el color y la forma significan algo— aplicada a un
 * fondo: quien no se fije verá textura, y quien se fije verá una temporada.
 */

/** Los tres estados de una celda. Ver la nota de arriba. */
type CellKind = "plain" | "lit" | "pending";

interface MeshCluster {
  /** Anclaje. Solo se declaran los dos bordes que hacen falta. */
  top?: DimensionValue;
  bottom?: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  cols: number;
  rows: number;
  /** Lado de la celda y hueco entre celdas. */
  cell: number;
  gap: number;
  opacity: number;
  /**
   * Hacia dónde se apaga el grupo.
   *
   * Siempre en dirección al contenido: lo que va pegado a un borde de la
   * pantalla puede pesar, y lo que se adentra hacia el texto tiene que haberse
   * ido del todo antes de llegar.
   */
  fade: "down" | "up";
  /** Índices con estado especial. El resto son `plain`. */
  lit: number[];
  pending: number[];
}

/**
 * Cuatro grupos, deliberadamente desiguales y colocados donde se ven.
 *
 * ## Dónde se ve un fondo en estas pantallas
 *
 * Casi todo el contenido de la ficha de un grupo va dentro de tarjetas
 * **opacas**, así que el fondo desaparece debajo de ellas. Lo que queda a la
 * vista es solo tres cosas: el aire de la cabecera, los dos márgenes laterales
 * y los huecos entre tarjetas. Repartir la retícula «por la pantalla» sin tener
 * eso en cuenta es pintar la mitad de las celdas debajo de una tapa.
 *
 * Por eso hay un bloque denso arriba —donde hay aire de verdad—, dos hilos
 * finos metidos en los márgenes izquierdo y derecho a distintas alturas, y uno
 * suelto abajo, que es donde se acaba el contenido y vuelve a haber sitio.
 *
 * ## Por qué a escalas distintas
 *
 * Tres bloques del mismo tamaño repartidos por la pantalla se leen como papel
 * pintado. Cambiando el tamaño de la celda entre grupos —12, 9 y 15— se leen
 * como una misma cosa vista desde distintas distancias, que es lo que hace que
 * el conjunto tenga profundidad estando completamente quieto.
 *
 * Las listas de índices están escritas a mano y no salen de `Math.random()`: el
 * fondo tiene que ser idéntico cada vez que se abre la pantalla. Un patrón que
 * cambia en cada montaje se nota —vuelves al grupo y «algo» ha cambiado— aunque
 * no sepas decir qué.
 */
const MESH_CLUSTERS: MeshCluster[] = [
  // Denso, arriba a la derecha: detrás de la cabecera, que es donde hay aire.
  {
    top: -26,
    right: -22,
    cols: 4,
    rows: 5,
    cell: 12,
    gap: 18,
    opacity: 0.32,
    fade: "down",
    lit: [2, 9],
    pending: [1, 4, 7, 11, 14, 17, 18],
  },
  // Hilo en el margen izquierdo, a media altura. Una sola columna, y metida
  // dentro del margen de la pantalla: así nunca cae debajo de una tarjeta.
  {
    top: "34%",
    left: 3,
    cols: 1,
    rows: 5,
    cell: 9,
    gap: 15,
    opacity: 0.22,
    fade: "down",
    lit: [],
    pending: [1, 3],
  },
  // El del margen derecho va más abajo que el izquierdo a propósito: a la misma
  // altura, los dos harían de paréntesis y encuadrarían el contenido como si
  // fueran parte de la interfaz.
  {
    top: "58%",
    right: -4,
    cols: 1,
    rows: 4,
    cell: 9,
    gap: 15,
    opacity: 0.2,
    fade: "up",
    lit: [1],
    pending: [0, 2],
  },
  // Suelto y más grande, abajo a la izquierda: donde se acaba el contenido y
  // vuelve a haber sitio. Es el más cercano de los cuatro — celda de 15.
  {
    bottom: -30,
    left: -20,
    cols: 3,
    rows: 3,
    cell: 15,
    gap: 28,
    opacity: 0.18,
    fade: "up",
    lit: [4],
    pending: [0, 2, 7],
  },
];

function AmbientMeshBase(): ReactElement {
  return (
    <>
      {MESH_CLUSTERS.map((cluster, index) => (
        <MeshBlock key={index} spec={cluster} />
      ))}
    </>
  );
}

export const AmbientMesh = memo(AmbientMeshBase);

function MeshBlock({ spec }: { spec: MeshCluster }): ReactElement {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.mesh,
        {
          top: spec.top,
          bottom: spec.bottom,
          left: spec.left,
          right: spec.right,
          width: spec.cols * (spec.cell + spec.gap),
        },
      ]}
    >
      {Array.from({ length: spec.cols * spec.rows }, (_, index) => {
        const kind: CellKind = spec.lit.includes(index)
          ? "lit"
          : spec.pending.includes(index)
            ? "pending"
            : "plain";

        const row = Math.floor(index / spec.cols);
        const falloff =
          spec.fade === "down"
            ? 1 - row / spec.rows
            : (row + 1) / spec.rows;

        /*
          El contorno va más subido que el relleno.

          Un cuadrado hueco de un píxel de trazo pone muchísima menos tinta que
          uno macizo del mismo tamaño, así que a igual opacidad desaparece. El
          factor iguala lo que se ve, no el número.
        */
        const weight = kind === "lit" ? 1.7 : kind === "pending" ? 1.5 : 1;

        return (
          <View
            key={index}
            style={[
              styles.cell,
              {
                width: spec.cell,
                height: spec.cell,
                marginRight: spec.gap,
                marginBottom: spec.gap,
                opacity: spec.opacity * falloff * weight,
              },
              kind === "pending"
                ? {
                    borderWidth: 1,
                    borderColor: Color.ambient.ringCool,
                  }
                : {
                    backgroundColor:
                      kind === "lit"
                        ? Color.ambient.ringWarm
                        : Color.ambient.ringCool,
                  },
            ]}
          />
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hilo — el chat de un grupo
// ---------------------------------------------------------------------------

/**
 * Cuatro burbujas enormes y vacías, cortadas por los bordes de la pantalla.
 *
 * ## Por qué esta forma
 *
 * La familia ya reparte manchas, aros, anillos, franjas, un cono, columnas y
 * una retícula. Lo que faltaba aquí no era otra forma abstracta: es que el chat
 * **ya tiene la suya**. Sus burbujas llevan tres esquinas redondas y una viva,
 * y esa silueta no se parece a nada más de la aplicación. El fondo la repite a
 * un tamaño en el que deja de ser un objeto y pasa a ser atmósfera.
 *
 * Se alternan izquierda y derecha bajando por la pantalla, y cada una lleva el
 * pico del lado que le tocaría —las de la izquierda abajo a la izquierda, las
 * de la derecha abajo a la derecha—, porque eso es lo que es una conversación:
 * una ida y vuelta que baja. No es decoración con forma de burbuja; es la
 * estructura del contenido, dibujada detrás de él.
 *
 * Solo la de arriba enseña la silueta entera; las otras tres asoman por su
 * borde como el resto de la familia. El porqué está en `THREAD_BUBBLES`.
 *
 * ## Por qué solo el contorno, y tan grandes
 *
 * Macizas competirían con las burbujas de verdad, que son justo lo que hay que
 * leer. Y a tamaño de burbuja se confundirían con un mensaje mal pintado: un
 * contorno de 260 puntos sin texto dentro no puede leerse como contenido, y ahí
 * está el truco. Todas se salen por su borde, como el resto de la familia.
 *
 * ## Por qué NO se mueve
 *
 * Es la única pantalla de la app donde **el contenido se mueve solo**: llegan
 * mensajes, la lista salta, el teclado sube y baja. Un fondo que además
 * respirase convertiría esos movimientos —que significan algo— en uno más del
 * montón. Aquí la quietud es lo que deja que se note lo que sí importa.
 */

interface BubbleSpec {
  top?: DimensionValue;
  bottom?: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  width: number;
  height: number;
  /** De qué lado cuelga el pico. El de la izquierda es lo ajeno. */
  side: "left" | "right";
  /** El par frío o el cálido, como en el resto de la familia. */
  cool: boolean;
  opacity: number;
}

/**
 * Cuatro, alternando lado y bajando. Los tamaños son desiguales a propósito:
 * cuatro iguales se leerían como un patrón, y un patrón es papel pintado.
 *
 * **Solo la primera enseña el pico**, y por eso es la única que se sale por
 * arriba en vez de por un lado: un rectángulo cortado por el costado pierde
 * justo las dos esquinas de abajo, que son las que dicen que esto es una
 * burbuja. Se pone donde primero cae la vista al abrir la pantalla —el aire de
 * la cabecera, antes de que cargue la conversación— y las otras tres se
 * comportan como el resto de la familia: manchas asomando por su borde. Con
 * cuatro siluetas completas esto dejaría de ser un fondo y sería un dibujo.
 */
const THREAD_BUBBLES: BubbleSpec[] = [
  // La que se lee. Desbordada por arriba, así que conserva el pico de abajo a
  // la izquierda: la forma exacta de un mensaje ajeno, a tamaño de atmósfera.
  { top: -116, left: 12, width: 252, height: 202, side: "left", cool: true, opacity: 0.32 },
  // La respuesta, asomando por la derecha a la altura del primer tramo de
  // conversación, dentro del margen que las burbujas de verdad no ocupan.
  { top: 244, right: -138, width: 230, height: 122, side: "right", cool: false, opacity: 0.28 },
  // Vuelve a la izquierda y es la más plana: a media pantalla el contenido es
  // más denso, así que aquí el fondo tiene que pesar menos.
  { top: "56%", left: -158, width: 240, height: 98, side: "left", cool: true, opacity: 0.22 },
  // La última, grande y abajo a la derecha: detrás del campo de escritura, que
  // es de donde sale lo próximo que se diga.
  { bottom: -92, right: -132, width: 296, height: 188, side: "right", cool: false, opacity: 0.26 },
];

function AmbientThreadBase(): ReactElement {
  return (
    <>
      {THREAD_BUBBLES.map((bubble, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[
            styles.threadBubble,
            bubble.side === "left" ? styles.threadTailLeft : styles.threadTailRight,
            {
              top: bubble.top,
              bottom: bubble.bottom,
              left: bubble.left,
              right: bubble.right,
              width: bubble.width,
              height: bubble.height,
              borderColor: bubble.cool
                ? Color.ambient.ringCool
                : Color.ambient.ringWarm,
              opacity: bubble.opacity,
            },
          ]}
        />
      ))}
    </>
  );
}

export const AmbientThread = memo(AmbientThreadBase);

// ---------------------------------------------------------------------------
// La mesa
// ---------------------------------------------------------------------------

/**
 * El fondo de una partida en grupo: **la mesa y los asientos**.
 *
 * Séptimo miembro de la familia, y el primero cuyo movimiento **significa algo**
 * en vez de solo respirar. La regla de la familia es que cada pantalla tiene su
 * forma y que esa forma dice algo de la pantalla —manchas desbordadas en la
 * portada, anillos concéntricos en un menú, franjas paralelas bajo una lista,
 * un haz de luz en el perfil—. Aquí la pantalla es literalmente **gente sentada
 * alrededor de una mesa pasándose un móvil**, así que el fondo es eso: un halo
 * ancho desbordado por abajo, con seis muestras posadas en su borde y una luz
 * que va de una a la siguiente.
 *
 * Esa luz **es el turno**. Es la única animación de toda la familia que no es
 * atmósfera: las demás laten o se desplazan para que la pantalla no parezca
 * congelada, y esta cuenta la mecánica del juego antes de que nadie la lea. Se
 * puede permitir el gesto porque es la mecánica de estas dos pantallas y de
 * ninguna otra — configurar la partida y anunciar a quién le toca.
 *
 * ## Por qué aquí sí hay seis pigmentos
 *
 * Va contra la regla de la casa —lo único saturado en pantalla debe ser el color
 * del juego— y se permite por el mismo motivo que el abanico del estado vacío
 * del online: **en estas dos pantallas todavía no hay color de juego**. No se ha
 * repartido ninguna imagen, así que no hay nada con lo que competir. En cuanto
 * empieza el turno, esta mesa desaparece y aparece el color de verdad.
 *
 * Aun así se queda muy por debajo del umbral de «elemento»: los asientos van al
 * 16 % y solo el encendido llega a la mitad. Lo que se ve es un lavado, no seis
 * puntos de colores.
 *
 * ## El tono
 *
 * La mesa toma el color del **modo** —ver `PARTY_TONE`—; los asientos, cada uno
 * el suyo. Son dos cosas distintas y por eso llevan colores distintos: la mesa
 * es a qué se juega, los asientos son quiénes juegan.
 */

/**
 * Una vuelta entera de la luz a la mesa: dos segundos y medio por asiento.
 *
 * Estuvo en 9,2 s —1,5 s por asiento— y se veía a saltos. El motivo no era la
 * velocidad en sí, sino que a ese ritmo cada asiento recorría todo su brillo en
 * medio segundo: el ojo no seguía una luz, veía seis cosas encendiéndose por
 * turnos. Al ralentizarlo, el mismo recorrido pasa a leerse como una sola cosa
 * que se desplaza, que es lo que tenía que decir desde el principio.
 */
const RELAY_MS = 15_000;
/** Latido de la mesa. Lento, como todos los de la familia. */
const TABLE_MS = 5200;

/**
 * Cómo de lejos alcanza la luz, medido en asientos.
 *
 * Por encima de 1 los vecinos se solapan, y eso es lo que hace que la luz
 * **viaje** en vez de encenderse y apagarse en seis sitios: cuando uno empieza a
 * bajar el siguiente ya está subiendo. A 0,6 se veían seis parpadeos; a 1,35
 * seguían distinguiéndose los relevos. A 1,5 hay siempre tres asientos con algo
 * de luz, y el conjunto se lee como una onda.
 */
const RELAY_REACH = 1.5;

interface SeatSpec {
  /** Posición horizontal, en porcentaje del ancho de la pantalla. */
  left: DimensionValue;
  /** Altura sobre el borde inferior. */
  bottom: number;
  size: number;
  tone: SpectrumTone;
}

/**
 * Seis asientos formando un arco sobre el borde de la mesa.
 *
 * Seis y no ocho porque son los seis pigmentos del espectro: con un séptimo
 * habría que repetir uno, y dos asientos del mismo color en la misma mesa se
 * leen como un error. El arco es simétrico y los de los extremos son más
 * pequeños —los de en medio quedan más cerca de quien mira—, que es lo que
 * convierte una fila de puntos en una mesa vista desde arriba.
 *
 * Van abajo porque abajo es donde estas dos pantallas tienen sitio: la de
 * configuración termina en un botón y la del turno es una sola tarjeta corta,
 * con media pantalla libre debajo.
 */
const SEATS: SeatSpec[] = [
  { left: "5%", bottom: 92, size: 20, tone: "rose" },
  { left: "21%", bottom: 146, size: 26, tone: "amber" },
  { left: "39%", bottom: 176, size: 32, tone: "green" },
  { left: "59%", bottom: 176, size: 32, tone: "teal" },
  { left: "77%", bottom: 146, size: 26, tone: "blue" },
  { left: "92%", bottom: 92, size: 20, tone: "violet" },
];

/**
 * Un reloj 0 → 1 que **no vuelve atrás**.
 *
 * `useAmbientClock` va y vuelve, que es lo correcto para algo que respira; una
 * luz que da la vuelta a una mesa no puede desandar el camino, porque entonces
 * el turno iría hacia atrás la mitad del tiempo. El salto de 1 a 0 no se ve: la
 * distancia entre la luz y cada asiento se mide por el camino más corto de los
 * dos, así que el final del recorrido ya está iluminando el primer asiento.
 */
function useRelayClock(): SharedValue<number> {
  const clock = useSharedValue(0);

  useEffect(() => {
    clock.set(
      withRepeat(
        withTiming(1, { duration: RELAY_MS, easing: Easing.linear }),
        -1,
        false,
        undefined,
        // Mismo motivo que en `useAmbientClock`: es un lavado de fondo, no algo
        // que se pueda perder por no mirarlo.
        ReduceMotion.Never,
      ),
    );
  }, [clock]);

  return clock;
}

function AmbientTableBase({ tone }: { tone?: SpectrumTone }): ReactElement {
  const relay = useRelayClock();
  const breath = useAmbientClock(TABLE_MS);

  const pigment =
    tone != null ? Color.spectrum[tone].pigment : Color.ambient.ringCool;

  /**
   * La mesa solo cambia de opacidad, y esto es una corrección, no una
   * simplificación estética.
   *
   * Llevaba además un `scaleX` del 2 %, y esos dos puntos porcentuales salían
   * carísimos: es una vista tan ancha como la pantalla, con un radio de cápsula
   * y un degradado dentro, así que escalarla obliga a **recalcular su recorte
   * redondeado en cada fotograma**. El coste no se notaba en la mesa —que
   * apenas se mueve— sino en todo lo demás: los fotogramas que se perdían ahí
   * eran los que hacían que la luz de los asientos avanzara a tirones.
   *
   * Por lo mismo se ha quitado el `overflow: hidden` que tenía: era redundante,
   * porque el degradado ya lleva el mismo radio que su contenedor, y era una
   * capa de recorte más en la vista más grande de la pantalla.
   */
  const tableStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + breath.get() * 0.1,
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[styles.table, { borderColor: pigment }, tableStyle]}
      >
        {/*
          El degradado sube desde abajo: la mesa está iluminada por su propio
          borde inferior, que es el que queda fuera de la pantalla. Relleno
          plano, un óvalo de 420 puntos se leía como una forma pegada encima.
        */}
        <LinearGradient
          colors={["transparent", pigment]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.fill}
        />
      </Animated.View>

      {SEATS.map((seat, index) => (
        <Seat key={seat.tone} spec={seat} index={index} relay={relay} />
      ))}
    </>
  );
}

export const AmbientTable = memo(AmbientTableBase);

function Seat({
  spec,
  index,
  relay,
}: {
  spec: SeatSpec;
  index: number;
  relay: SharedValue<number>;
}): ReactElement {
  const seatStyle = useAnimatedStyle(() => {
    // Dónde está la luz ahora mismo, en asientos.
    const at = relay.get() * SEATS.length;

    // Por el camino más corto: sin esto, la luz tendría que recorrer la mesa
    // entera hacia atrás para volver del último asiento al primero.
    const straight = Math.abs(at - index);
    const distance = Math.min(straight, SEATS.length - straight);

    /*
      La caída del brillo es una campana, no una rampa, y aquí estaba el motivo
      principal de que la luz avanzara a tirones.

      Antes era `1 - distancia / alcance`: una recta, y por tanto un triángulo
      —el brillo subía a ritmo constante, **giraba en seco** justo en el máximo,
      y volvía a cortarse en seco al llegar al límite del alcance—. Esas dos
      esquinas son cambios instantáneos de velocidad, y el ojo las lee
      exactamente como lo que son: un salto. No importaba cuántos fotogramas por
      segundo hubiera; la curva ya era angulosa antes de dibujarse.

      El coseno alzado vale 1 en el centro y 0 en el borde igual que la recta,
      pero **llega a los dos extremos con pendiente cero**: la luz frena al
      llegar al asiento y arranca al salir, sin ninguna esquina en medio. Es la
      misma curva que `Easing.inOut` aplica al tiempo, aplicada aquí al espacio.
    */
    const reach = Math.min(1, distance / RELAY_REACH);
    const lit = (1 + Math.cos(Math.PI * reach)) / 2;

    /*
      Los asientos **se encienden, no crecen**, y esto es lo que hace que el
      recorrido se vea fluido.

      Antes cambiaban de tamaño con un `scale` de hasta 1,35, y ese era el gesto
      que iba a tirones. Un asiento de 32 puntos creciendo hasta 43 cambia once
      píxeles a lo largo de casi cuatro segundos: el borde redondeado tiene que
      volver a resolverse en cada fotograma para un desplazamiento de una
      centésima de píxel, y lo que se ve no es una bola creciendo sino su canto
      temblando. Suavizar la curva no lo arregló, y no podía: el problema no
      estaba en cuándo cambiaba el tamaño, sino en que cambiara.

      La opacidad no tiene ese problema. No cambia ninguna geometría —no hay
      borde que recalcular, ni textura que reescalar—, así que va suave a
      cualquier velocidad y a cualquier tamaño. Y para lo que esta pantalla
      tiene que decir sirve igual o mejor: un asiento que se ilumina al llegarle
      el turno es más literal que uno que engorda.

      El recorrido va de 0,10 a 0,72 en vez del 0,16-0,56 de antes. Al perder el
      tamaño hay que recuperar la presencia por algún lado, y el sitio correcto
      es el contraste entre el asiento encendido y los demás.
    */
    return { opacity: 0.1 + lit * 0.62 };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        {
          left: spec.left,
          bottom: spec.bottom,
          width: spec.size,
          height: spec.size,
          backgroundColor: Color.spectrum[spec.tone].pigment,
        },
        seatStyle,
      ]}
    />
  );
}

/**
 * Los radios de los discos de `SoftGlow`, del mayor al menor. Doce capas es
 * el punto donde la escalera deja de percibirse sin llenar el árbol de vistas.
 */
const GLOW_LAYERS = Array.from({ length: 12 }, (_, i) => 1 - i * 0.08);

const ORB_SIZE = 320;
const HAZE_SIZE = 420;
/**
 * El orbe difuminado es bastante mayor que el macizo, y a propósito: un halo
 * sin borde solo se lee como lavado de color si su caída ocupa media pantalla.
 */
const BLUR_ORB_SIZE = 460;

const styles = StyleSheet.create({
  band: {
    position: "absolute",
    // Más anchas que la pantalla: giradas 22 grados, una banda del ancho justo
    // dejaría las dos esquinas sin cubrir.
    left: -140,
    right: -140,
  },
  table: {
    position: "absolute",
    // Desbordada por los tres lados: de la mesa solo entra su borde de arriba,
    // que es justo lo que hace que se lea como una mesa y no como un óvalo.
    left: "-20%",
    right: "-20%",
    bottom: -230,
    height: 420,
    borderRadius: Radius.pill,
    borderWidth: HAIRLINE,
    // Sin `overflow: hidden`: el degradado de dentro ya lleva este mismo radio,
    // así que el recorte sobraba — y era una capa más que recalcular en la
    // vista más grande de la pantalla. Ver la nota de `tableStyle`.
  },
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
  // El difuminado no lleva `borderRadius`: no tiene borde que redondear.
  blurOrb: {
    position: "absolute",
    width: BLUR_ORB_SIZE,
    height: BLUR_ORB_SIZE,
  },
  fill: {
    flex: 1,
    borderRadius: Radius.pill,
  },
  beam: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -40,
    bottom: 0,
  },
  pool: {
    position: "absolute",
    // Mas ancho que la pantalla: un charco que se corta en los lados delata
    // que es un rectangulo redondeado y no luz.
    left: "-15%",
    right: "-15%",
    top: "26%",
    height: 220,
    borderRadius: Radius.pill,
  },
  mesh: {
    // Cada grupo se coloca y se dimensiona a sí mismo: lo único que comparten
    // es que van desbordados por su borde, como el resto de la familia. Una
    // retícula entera y centrada se leería como un elemento de la interfaz y no
    // como un fondo.
    position: "absolute",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    // Apenas redondeado: a 8-15 px, un radio mayor los convierte en puntos y se
    // pierde lo único que esta forma aporta a la familia, que es tener esquinas.
    borderRadius: 3,
  },
  threadBubble: {
    position: "absolute",
    // Solo contorno, y del más fino que dibuja la plataforma. Es lo que deja
    // que una forma de 260 puntos siga siendo fondo.
    borderWidth: HAIRLINE,
    // Los mismos radios que una burbuja de verdad: tres redondas y una viva.
    borderRadius: Radius.xl,
  },
  threadTailLeft: {
    borderBottomLeftRadius: Radius.sm / 2,
  },
  threadTailRight: {
    borderBottomRightRadius: Radius.sm / 2,
  },
  circle: {
    position: "absolute",
    // Solo contorno, y del más fino que dibuja la plataforma: es lo que deja
    // que una forma de 300 puntos siga siendo fondo y no un objeto.
    borderWidth: HAIRLINE,
    borderRadius: Radius.pill,
  },
  column: {
    position: "absolute",
    // Desbordada por abajo: la columna respira desplazandose, y sin este
    // margen el recorrido dejaria ver el lienzo bajo ella en cada ciclo.
    bottom: -12,
    borderTopLeftRadius: Radius.pill,
    borderTopRightRadius: Radius.pill,
    overflow: "hidden",
  },
  columnFill: {
    flex: 1,
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
  blurTopLeft: {
    top: -170,
    left: -180,
  },
  blurBottomRight: {
    bottom: -190,
    right: -190,
  },
});
