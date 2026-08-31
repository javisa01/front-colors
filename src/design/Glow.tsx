import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useState, type ReactElement, type ReactNode } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Color, Radius } from "@/design/tokens";

/**
 * Borde de aurora: un degradado azul→violeta→magenta que gira despacio
 * alrededor de una superficie.
 *
 * ## Para qué existe
 *
 * La interfaz es casi acromática a propósito —lo único saturado debe ser el
 * color del juego— y eso funciona dentro de una partida, pero deja el menú en
 * blanco y negro: nada tira del ojo hacia lo que hay que hacer hoy. Esto lo
 * resuelve sin romper la regla, porque **el color no rellena nada**: vive en un
 * borde de píxel y medio, no toca el fondo ni el texto, y no compite con
 * ninguna muestra de color del juego.
 *
 * ## Uno por pantalla
 *
 * La regla de uso es la misma que la de la tarjeta acentuada: si dos
 * superficies brillan, ninguna es la principal. Va en la tarjeta del reto de
 * hoy y en ningún sitio más de esa pantalla.
 *
 * ## Cómo está hecho
 *
 * `react-native-svg` no tiene degradado cónico y `expo-linear-gradient` solo
 * hace rectas, así que el efecto de «recorrido» se consigue **girando un
 * degradado lineal** por detrás de la superficie y dejando ver únicamente el
 * marco: el hijo tapa el centro, y lo que asoma por los cuatro lados es el
 * borde. Es la técnica de siempre para esto y no cuesta ni una capa de más.
 *
 * El cuadro que gira tiene que medir **la diagonal** del contenedor, no su
 * ancho: un cuadrado del tamaño de la tarjeta, al girar 45°, deja las cuatro
 * esquinas sin pintar. Por eso hay un `onLayout`: sin medir no se puede saber
 * cuánto hay que agrandarlo.
 */

interface GlowBorderProps {
  children: ReactNode;
  /** Radio exterior. El interior se calcula restando el grosor. */
  radius?: number;
  /** Grosor del marco visible. Por encima de 2 deja de ser un borde. */
  width?: number;
  /** Una vuelta completa. Largo a propósito: ver la nota de movimiento. */
  durationMs?: number;
  /** Relleno de la superficie interior. */
  surface?: string;
  /** Congela el degradado. Para estados donde ya no hay nada que hacer. */
  still?: boolean;
  /** Padding interior de la superficie. */
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Una vuelta cada doce segundos.
 *
 * Es deliberadamente lentísimo. A cuatro o cinco segundos el borde se lee como
 * «cargando» y pide atención constante; a doce se percibe como que la tarjeta
 * está viva, que es justo lo que hace falta para que el ojo vuelva a ella sin
 * que moleste mientras se lee el resto de la pantalla.
 */
const SPIN_MS = 12_000;

function GlowBorderBase({
  children,
  radius = Radius.xl,
  width = 1.5,
  durationMs = SPIN_MS,
  surface = Color.surface.raised,
  still = false,
  padding,
  style,
}: GlowBorderProps): ReactElement {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const spin = useSharedValue(0);

  useEffect(() => {
    if (still) {
      return;
    }

    /**
     * `ReduceMotion.Never`, igual que los orbes de la portada.
     *
     * Con el movimiento reducido del sistema activado —en Windows, «mostrar
     * animaciones» apagado— Reanimated cancela los bucles infinitos en el
     * primer fotograma y el valor se queda clavado, sin aviso. Aquí se
     * desactiva ese comportamiento por el mismo motivo que allí: esto es un
     * lavado de color decorativo, gira una vez cada doce segundos, no parpadea,
     * no desplaza contenido y no hay nada que perderse si no se mira. El resto
     * de la app —entradas, pulsaciones— sigue respetando el ajuste.
     *
     * Si algún día hay que respetarlo también aquí, la línea a cambiar es esta
     * y basta con quitar el argumento: el borde se queda quieto y sigue siendo
     * un degradado perfectamente legible.
     */
    spin.set(
      withRepeat(
        withTiming(1, { duration: durationMs, easing: Easing.linear }),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      ),
    );
  }, [durationMs, spin, still]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.get() * 360}deg` }],
  }));

  const onLayout = (event: LayoutChangeEvent): void => {
    const { width: w, height: h } = event.nativeEvent.layout;
    // Solo se reasigna cuando cambia de verdad: `onLayout` se dispara en cada
    // repintado y un `setState` incondicional aquí es un bucle de renders.
    setSize((previous) =>
      Math.abs(previous.width - w) < 1 && Math.abs(previous.height - h) < 1
        ? previous
        : { width: w, height: h },
    );
  };

  // La diagonal: es el diámetro del círculo que envuelve al rectángulo, así
  // que a cualquier ángulo el degradado sigue cubriendo las cuatro esquinas.
  const side = Math.hypot(size.width, size.height);

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.frame,
        { borderRadius: radius, padding: width },
        style,
      ]}
    >
      {side > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.spinner,
            {
              width: side,
              height: side,
              left: (size.width - side) / 2,
              top: (size.height - side) / 2,
            },
            spinStyle,
          ]}
        >
          <LinearGradient
            colors={Color.glow.stops}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}

      <View
        style={[
          styles.surface,
          {
            borderRadius: Math.max(0, radius - width),
            backgroundColor: surface,
            padding,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export const GlowBorder = memo(GlowBorderBase);

const styles = StyleSheet.create({
  frame: {
    // Recorta el cuadro que gira al radio del marco. Sin esto se ven las
    // esquinas del degradado sobresaliendo por fuera de la tarjeta.
    overflow: "hidden",
    // Lo que se ve antes de que `onLayout` mida, y lo que queda si el
    // degradado no llega a montarse: un borde normal, no un hueco.
    backgroundColor: Color.border.default,
  },
  spinner: {
    position: "absolute",
  },
  surface: {
    // El hijo va después del degradado en el árbol, así que lo tapa sin
    // necesidad de `zIndex`. Su propio recorte evita que el contenido se salga
    // por las esquinas redondeadas.
    overflow: "hidden",
  },
});
