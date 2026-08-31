import { memo, useEffect, type ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Ellipse, Path } from "react-native-svg";

import { Color } from "@/design/tokens";

/**
 * La llama de la racha.
 *
 * ## Por qué está encendida o apagada
 *
 * No es un adorno con dos colores: **el estado es la información**. Apagada
 * significa «llevas 12 jornadas y hoy todavía no has jugado»; encendida
 * significa «hoy ya está asegurada». Es la misma idea que gobierna el menú
 * entero —todo empieza sin color y jugar es lo que lo devuelve—, aplicada al
 * único dato que persiste entre días.
 *
 * Esa es también la razón de que la llama sea lo único cálido de una interfaz
 * deliberadamente fría: en una pantalla de grises, un naranja de 20 px se lleva
 * la mirada sin necesitar tamaño, y no le quita contraste a nada porque no hay
 * ningún otro color con el que pelearse.
 *
 * ## Por qué no es el icono `flame`
 *
 * El catálogo tiene uno, pero es de trazo y de un solo color. Aquí hacen falta
 * tres capas que se muevan por separado —el cuerpo, la lengua interior y el
 * núcleo—, porque un fuego de una sola pieza que escala entero no parece fuego,
 * parece un icono latiendo.
 *
 * ## El movimiento
 *
 * Los tres ciclos son primos entre sí (1450, 1130 y 870 ms), así que la
 * combinación tarda minutos en repetirse y el parpadeo nunca cae en un compás
 * reconocible. Con tres relojes múltiplos se vería el bucle a los pocos
 * segundos.
 */

interface FlameProps {
  /** Alto del dibujo. El ancho sale de la proporción del `viewBox`. */
  size?: number;
  /** Apagada mientras la racha de hoy no esté asegurada. */
  lit: boolean;
}

const BODY_MS = 1_450;
const TONGUE_MS = 1_130;
const CORE_MS = 870;

/** Proporción del `viewBox`: 24 de ancho por 30 de alto. */
const RATIO = 24 / 30;

/**
 * Un reloj 0 → 1 → 0 en bucle.
 *
 * `ReduceMotion.Never` por el mismo motivo que en los orbes de la portada: con
 * el movimiento reducido del sistema, `withRepeat` infinito con `reverse`
 * empieza y acaba en el mismo punto, así que Reanimated lo cancela en el primer
 * fotograma y la llama se queda congelada sin decir nada. Aquí el movimiento no
 * desplaza contenido ni oculta información —la cifra de la racha está al lado y
 * se lee igual—, así que se fuerza.
 */
function useFlicker(durationMs: number, enabled: boolean): SharedValue<number> {
  const clock = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      clock.set(0);
      return;
    }

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
  }, [clock, durationMs, enabled]);

  return clock;
}

function FlameBase({ size = 24, lit }: FlameProps): ReactElement {
  const body = useFlicker(BODY_MS, lit);
  const tongue = useFlicker(TONGUE_MS, lit);
  const core = useFlicker(CORE_MS, lit);

  const width = size * RATIO;

  /**
   * El cuerpo se estira y se encoge en vertical mientras se estrecha en
   * horizontal, que es como se comporta una llama real: conserva el volumen.
   * Escalar los dos ejes a la vez la haría parecer un globo hinchándose.
   */
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleY: 1 + body.get() * 0.08 },
      { scaleX: 1 - body.get() * 0.05 },
      { translateY: -body.get() * 1 },
    ],
  }));

  const tongueStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleY: 1 - tongue.get() * 0.1 },
      { scaleX: 1 + tongue.get() * 0.08 },
      { translateY: tongue.get() * 1.2 },
    ],
  }));

  const coreStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + core.get() * 0.45,
    transform: [{ scale: 0.82 + core.get() * 0.28 }],
  }));

  const outer = lit ? Color.ember.outer : Color.ember.dimOuter;
  const inner = lit ? Color.ember.inner : Color.ember.dimInner;

  return (
    <View style={{ width, height: size }} pointerEvents="none">
      {/* El origen de las tres capas está abajo: una llama crece desde su
          base, no desde su centro. */}
      <Animated.View style={[styles.layer, styles.fromBase, bodyStyle]}>
        <Svg width={width} height={size} viewBox="0 0 24 30">
          <Path
            d="M12 0c1 6 6 8 6 14a6 6 0 0 1-.6 2.6C18.9 15.4 20 13.6 20 13.6c1.3 2 2 4.2 2 6.4a10 10 0 0 1-20 0c0-4 2-7.4 5-10.3 0 0-.4 2.6.8 4.3C7 10 10 7 12 0z"
            fill={outer}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.layer, styles.fromBase, tongueStyle]}>
        <Svg width={width} height={size} viewBox="0 0 24 30">
          <Path
            d="M12 11c.7 3.4 4 4.6 4 8.2a4 4 0 0 1-8 0c0-2.3 1.4-3.6 2.2-5.4.5 1 1 1.6 1 1.6.3-1.7.5-3 .8-4.4z"
            fill={inner}
          />
        </Svg>
      </Animated.View>

      {/* El núcleo solo existe encendida: apagada sería un punto claro sin
          motivo en mitad de una forma gris. */}
      {lit ? (
        <Animated.View style={[styles.layer, styles.fromBase, coreStyle]}>
          <Svg width={width} height={size} viewBox="0 0 24 30">
            <Ellipse cx="12" cy="23" rx="2" ry="3.2" fill={Color.ember.core} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

export const Flame = memo(FlameBase);

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  fromBase: {
    transformOrigin: "bottom",
  },
});
