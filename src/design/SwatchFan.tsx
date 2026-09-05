import { memo, useEffect, type ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { useAmbientActive } from "@/design/motion";
import { useColors, useThemedStyles } from "@/design/theme";
import {
  Motion,
  Radius,
  type Palette,
  type SpectrumTone,
} from "@/design/tokens";

/**
 * El abanico de muestras.
 *
 * ## Por qué existe
 *
 * Es la ilustración del estado vacío del modo online: la pantalla que ve quien
 * entra y todavía no está en ningún grupo. Esa pantalla era un icono gris
 * dentro de un cuadro gris, y tenía un problema que no era de estilo: era la
 * **primera** pantalla del modo online para alguien nuevo, y no enseñaba ni una
 * sola vez de qué va el juego. Nadie crea un grupo para entrar en una lista
 * vacía; se crea para jugar a algo, y ese algo hay que verlo.
 *
 * Así que la ilustración es el material del juego: cinco muestras de pintura
 * abiertas como el abanico de una carta de colores. No es decoración abstracta,
 * es el objeto con el que se juega.
 *
 * ## Por qué aquí sí y en el resto no
 *
 * Cinco rellenos saturados a la vez van justo en contra de la regla de la casa
 * —lo único saturado en pantalla debe ser el color del juego—, y aquí se pueden
 * permitir por un motivo concreto: **en esta pantalla no hay color de juego**.
 * No hay grupo, luego no hay reto, luego no hay logo que adivinar ni muestra
 * con la que compararlo. El abanico no compite con nada porque es lo único que
 * hay, y desaparece en cuanto existe un grupo — que es exactamente cuando
 * aparece el color de verdad.
 *
 * ## El movimiento
 *
 * Se abre al montarse, escalonado, y después respira. Abrirse es lo que
 * convierte cinco rectángulos apilados en un abanico: la forma final ya se
 * entendería quieta, pero el gesto de abrirse dice «esto se despliega», que es
 * lo que se le está pidiendo a quien mira. Después el vaivén es de un grado y
 * medio y tarda diez segundos en ir y volver — no se percibe como animación,
 * se percibe como que la pantalla no está congelada.
 *
 * ## Volver a abrirlo
 *
 * «Al montarse» no basta donde vive esto. La pantalla de inicio del online es
 * una pestaña, y una pestaña no se desmonta al salir de ella: quien se va al
 * ranking y vuelve encuentra el abanico ya abierto, sin el gesto que explica
 * qué es. Por eso `replay` — cada valor nuevo vuelve a repartir las muestras.
 *
 * No hay salto al reiniciar, y no por suerte: la opacidad de cada muestra **es**
 * su apertura, así que el estado cerrado es también el invisible. Lo que se ve
 * no es un abanico que se pliega de golpe, es uno que se reparte otra vez.
 */

/** Los cinco tonos, en el orden en el que se abren. */
const CHIPS: SpectrumTone[] = ["rose", "amber", "green", "teal", "violet"];

/**
 * Apertura total del abanico, en grados a cada lado.
 *
 * A 40 el abanico se abre tanto que las muestras de los extremos se ven casi
 * tumbadas y el conjunto deja de leerse como una carta de colores; a 20 apenas
 * se distingue de un montón mal apilado.
 */
const SPREAD = 30;

/** Medidas de una muestra. La proporción es la de una carta de color real. */
const CHIP_WIDTH = 46;
const CHIP_HEIGHT = 68;

/**
 * Dónde está el eje del abanico, medido desde el centro de una muestra.
 *
 * Las muestras giran alrededor de un punto que queda **por debajo** de ellas,
 * como el remache de una carta de colores. El giro por defecto es alrededor del
 * centro de la propia vista, así que el eje se baja con el truco de siempre:
 * bajar, girar y volver a subir.
 */
const PIVOT = 74;

/** Ciclo completo del vaivén, ida y vuelta. Largo a propósito. */
const SWAY_MS = 10_000;

/** Retardo entre una muestra y la siguiente al abrirse. */
const STAGGER_MS = 70;

function SwatchFanBase({
  replay = 0,
}: {
  /**
   * Cambia este número y el abanico se vuelve a abrir.
   *
   * Es un contador y no un booleano porque lo que se pide no es un estado
   * —«abierto» / «cerrado»— sino un gesto, y un gesto no se puede pedir dos
   * veces seguidas con el mismo valor.
   */
  replay?: number;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  const sway = useSharedValue(0);
  const active = useAmbientActive();

  useEffect(() => {
    // Parado mientras no se ve. Ver `useAmbientActive`.
    if (!active) {
      cancelAnimation(sway);
      sway.set(0);
      return;
    }

    sway.set(
      withRepeat(
        withTiming(1, { duration: SWAY_MS, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
        undefined,
        // Igual que los orbes y el borde de aurora: sin esto, un bucle infinito
        // con vuelta atrás se cancela en el primer fotograma cuando el sistema
        // pide movimiento reducido, y el abanico se queda clavado a medio abrir.
        ReduceMotion.Never,
      ),
    );
  }, [active, sway]);

  return (
    <View style={styles.stage} pointerEvents="none">
      {CHIPS.map((tone, index) => (
        <Chip
          key={tone}
          tone={tone}
          index={index}
          sway={sway}
          replay={replay}
        />
      ))}
    </View>
  );
}

export const SwatchFan = memo(SwatchFanBase);

function Chip({
  tone,
  index,
  sway,
  replay,
}: {
  tone: SpectrumTone;
  index: number;
  sway: SharedValue<number>;
  replay: number;
}): ReactElement {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  /** Su sitio en el abanico abierto: de −SPREAD a +SPREAD, repartido. */
  const target = -SPREAD + (index * (SPREAD * 2)) / (CHIPS.length - 1);

  const lift = useSharedValue(0);

  useEffect(() => {
    // Cerrada y sin pintar antes de repartir. En el primer montaje no hace
    // nada —ya vale cero—; al repetir es lo que devuelve la muestra al mazo
    // para que el escalonado tenga de dónde salir.
    lift.set(0);

    // El escalonado es lo que hace que se lea como un abanico que se abre y no
    // como cinco cosas que aparecen a la vez, y por eso cada muestra tiene su
    // propio muelle: uno compartido las abriria en bloque.
    lift.set(withDelay(index * STAGGER_MS, withSpring(1, Motion.springSoft)));
  }, [index, lift, replay]);

  const chipStyle = useAnimatedStyle(() => {
    // El vaivén centrado: reparte el recorrido a los dos lados del reposo en
    // vez de dejar el abanico siempre escorado hacia un lado.
    const drift = (sway.get() - 0.5) * 3;
    const angle = target * lift.get() + drift;

    return {
      opacity: lift.get(),
      transform: [
        { translateY: PIVOT },
        { rotate: `${angle}deg` },
        { translateY: -PIVOT },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.chip,
        { backgroundColor: colors.spectrum[tone].pigment },
        chipStyle,
      ]}
    >
      {/*
        La banda de tinta al pie: es lo que separa una muestra de pintura de un
        rectángulo de color. En una carta de colores real ahí va la referencia
        del tono, y basta con insinuarla — escribir un código inventado sería
        pedirle al ojo que lea algo que no significa nada.
      */}
      <View
        style={[styles.chipFoot, { backgroundColor: colors.spectrum[tone].ink }]}
      />
    </Animated.View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  stage: {
    height: CHIP_HEIGHT + 26,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    position: "absolute",
    width: CHIP_WIDTH,
    height: CHIP_HEIGHT,
    borderRadius: Radius.sm,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  chipFoot: {
    height: 12,
    // Al 45 %: la banda tiene que leerse como una etiqueta impresa sobre el
    // pigmento, no como una segunda muestra de otro color pegada debajo.
    opacity: 0.45,
  },
  });
