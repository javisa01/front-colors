import { memo, useEffect, type ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Ellipse, Path } from "react-native-svg";

import { useAmbientActive } from "@/design/motion";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  type Palette,
} from "@/design/tokens";

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
 *
 * ## Por qué se veía a saltos
 *
 * Tres cosas a la vez, y las tres arregladas aquí:
 *
 *  1. **La curva.** Iba con `inOut(quad)` y en bucle de ida y vuelta, que es
 *     una parábola: se queda casi quieta en los dos extremos y cruza el centro
 *     de golpe. Cuatro paradas por ciclo. La sinusoide —`inOut(sin)`, que de
 *     ida y vuelta da exactamente un seno— no tiene ni parones ni tirones: la
 *     velocidad nunca salta, que es literalmente lo que quiere decir fluido.
 *  2. **El recorrido, medido en píxeles.** Las amplitudes eran fijas y
 *     diminutas —1 px de desplazamiento, 8 % de escala—, y esta llama se pinta
 *     a 13 y 18 px. Sobre 18 px, un 8 % son 1,4 px: el redondeo al píxel
 *     convertía un movimiento continuo en dos o tres escalones visibles. Ahora
 *     el recorrido sale del propio `size`, así que la llama se mueve lo mismo
 *     —en proporción— mida lo que mida.
 *  3. **Lo que no se puede redondear.** Cuerpo y lengua modulan también su
 *     opacidad. La opacidad no cae en una rejilla de píxeles, así que hay
 *     cambio continuo en todos los fotogramas aunque la geometría todavía no
 *     haya llegado al píxel siguiente. Es lo que cose el movimiento.
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

/** Cuánto tarda en posarse al apagarse. Ver `useFlicker`. */
const SETTLE_MS = 260;

/** Proporción del `viewBox`: 24 de ancho por 30 de alto. */
const RATIO = 24 / 30;

/**
 * Un reloj 0 → 1 → 0 en bucle, con forma de seno.
 *
 * `inOut(sin)` no es un capricho de curva: reproducida hacia delante y hacia
 * atrás da `(1 - cos πt) / 2`, o sea un seno exacto, y un seno es la única
 * oscilación cuya velocidad no da ningún salto —ni en los extremos, donde una
 * curva lineal tira, ni en el centro, donde una parábola acelera de golpe.
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

  const active = useAmbientActive();

  useEffect(() => {
    // `active` entra aquí y no en una rama aparte porque apagar por no verse y
    // apagar por no tener racha son lo mismo para la llama: bucle cancelado y
    // vuelta al reposo. Ver `useAmbientActive`.
    if (!enabled || !active) {
      // Apagar no es cortar: se cancela el bucle y se vuelve al reposo con una
      // transición corta. Con un `set(0)` seco, la llama se quedaba clavada en
      // mitad del estiramiento el fotograma en que se apagaba.
      cancelAnimation(clock);
      clock.set(
        withTiming(0, {
          duration: SETTLE_MS,
          easing: Easing.out(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        }),
      );
      return;
    }

    clock.set(
      withRepeat(
        withTiming(1, {
          duration: durationMs,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
        undefined,
        ReduceMotion.Never,
      ),
    );

    return () => {
      cancelAnimation(clock);
    };
  }, [active, clock, durationMs, enabled]);

  return clock;
}

function FlameBase({ size = 24, lit }: FlameProps): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const body = useFlicker(BODY_MS, lit);
  const tongue = useFlicker(TONGUE_MS, lit);
  const core = useFlicker(CORE_MS, lit);

  const width = size * RATIO;

  /**
   * El cuerpo se estira y se encoge en vertical mientras se estrecha en
   * horizontal, que es como se comporta una llama real: conserva el volumen.
   * Escalar los dos ejes a la vez la haría parecer un globo hinchándose.
   *
   * El desplazamiento va en proporción al tamaño —no en píxeles sueltos—, que
   * es lo que hace que a 13 px se mueva tanto como a 24.
   */
  const bodyStyle = useAnimatedStyle(() => {
    const value = body.get();
    return {
      // Cambio continuo que no depende de la rejilla de píxeles: es lo que
      // impide que la llama parezca ir a escalones cuando es pequeña.
      opacity: 0.88 + value * 0.12,
      transform: [
        { scaleY: 1 + value * 0.11 },
        { scaleX: 1 - value * 0.07 },
        { translateY: -value * size * 0.05 },
      ],
    };
  });

  const tongueStyle = useAnimatedStyle(() => {
    const value = tongue.get();
    return {
      opacity: 0.78 + value * 0.22,
      transform: [
        { scaleY: 1 - value * 0.14 },
        { scaleX: 1 + value * 0.12 },
        { translateY: value * size * 0.055 },
      ],
    };
  });

  const coreStyle = useAnimatedStyle(() => {
    const value = core.get();
    return {
      opacity: 0.45 + value * 0.55,
      transform: [{ scale: 0.76 + value * 0.38 }],
    };
  });

  const outer = lit ? colors.ember.outer : colors.ember.dimOuter;
  const inner = lit ? colors.ember.inner : colors.ember.dimInner;

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
            <Ellipse cx="12" cy="23" rx="2" ry="3.2" fill={colors.ember.core} />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

export const Flame = memo(FlameBase);

const createStyles = (c: Palette) =>
  StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  fromBase: {
    transformOrigin: "bottom",
  },
  });
