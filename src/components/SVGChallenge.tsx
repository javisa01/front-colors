import { memo, useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";

import { Radius, Type } from "@/design/tokens";
import { t } from "@/i18n";
import type { ChallengeMetadata } from "@/types/challenge";
import { getChallengeBackgroundTheme } from "@/utils/color";
import { replaceColorInSvg } from "@/utils/svgMarkup";

/**
 * Fracción del lado de la tarjeta que se deja libre alrededor de una bandera.
 * 7 % a cada lado: suficiente para que se lea como una imagen dentro de un
 * marco y no como un fondo de pantalla, sin encogerla hasta perder detalle.
 */
const FLAG_INSET = 0.07;

interface SVGChallengeProps {
  challenge: ChallengeMetadata;
  editableColor: string;
  size: number;
  animationToken: number;
  // Which color of the logo the player is currently editing. Defaults to the
  // challenge's own `editableColorIndex`; multicolor mode overrides it per step.
  editableColorIndex?: number;
}

function SVGChallenge({
  challenge,
  editableColor,
  size,
  animationToken,
  editableColorIndex,
}: SVGChallengeProps): React.JSX.Element {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = 0;
    pulse.value = withSequence(
      withTiming(1, {
        duration: 120,
        easing: Easing.out(Easing.quad),
      }),
      withTiming(0, {
        duration: 220,
        easing: Easing.out(Easing.quad),
      }),
    );
  }, [animationToken, pulse]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: 1 + pulse.value * 0.04 }],
      opacity: 1 - pulse.value * 0.06,
    };
  });

  const svgMarkup = useMemo(() => {
    const activeIndex = editableColorIndex ?? challenge.editableColorIndex ?? 0;
    const editable = challenge.colors?.[activeIndex];
    // The colors drawn in the SVG (`svgColors`) can differ from the color the
    // player must guess (`hex`), and one guessable color may be painted with
    // several near-identical literals. We replace every one of them.
    const sourceColors =
      editable?.svgColors ??
      (editable?.svgColor ? [editable.svgColor] : undefined) ??
      (editable?.hex ? [editable.hex] : []);

    if (sourceColors.length === 0) {
      return "";
    }

    return replaceColorInSvg(challenge.svgXml, sourceColors, editableColor);
  }, [challenge, editableColor, editableColorIndex]);

  // Pick a card background that keeps the artwork readable: dark logos (e.g.
  // Amazon or Starbucks) would blend into the default dark card, so we switch to
  // a light one. This is based on the challenge's true colors, not the color the
  // player is currently predicting, so the background stays stable while playing.
  const backgroundTheme = useMemo(
    () => getChallengeBackgroundTheme(challenge),
    [challenge],
  );

  /**
   * Margen lateral extra para las banderas.
   *
   * Un logo es una forma suelta y trae su propio aire alrededor. Una bandera es
   * un rectángulo macizo de 4:3 que, dentro de una tarjeta cuadrada, toca los
   * dos cantos de lado a lado: parece que se sale, y el borde redondeado de la
   * tarjeta le corta las esquinas. El hueco arriba y abajo que deja la relación
   * de aspecto no pasa nada porque exista — el problema es solo horizontal —,
   * pero el `padding` va a los cuatro lados igualmente: recortar solo a los
   * lados descentraría el dibujo respecto a la tarjeta.
   *
   * Proporcional al tamaño y no un valor fijo de la escala de espaciado porque
   * la tarjeta cambia de lado entre teléfono y tableta, y un margen fijo se
   * vería generoso en una y ridículo en la otra.
   */
  const inset = challenge.category === "flag" ? Math.round(size * FLAG_INSET) : 0;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.svgWrapper,
          {
            width: size,
            height: size,
            padding: inset,
            backgroundColor: backgroundTheme.background,
            borderColor: backgroundTheme.border,
          },
          animatedStyle,
        ]}
      >
        {svgMarkup ? (
          <SvgXml xml={svgMarkup} width="100%" height="100%" />
        ) : (
          <View style={styles.fallback}>
            <Text style={styles.fallbackText}>{t("challenge.imageMissing")}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

export default memo(SVGChallenge);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  svgWrapper: {
    maxWidth: "100%",
    borderRadius: Radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  fallbackText: {
    ...Type.caption,
    textAlign: "center",
  },
});
