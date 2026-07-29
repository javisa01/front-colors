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

import type { ChallengeMetadata } from "@/types/challenge";
import { getChallengeBackgroundTheme, normalizeHex } from "@/utils/color";

interface SVGChallengeProps {
  challenge: ChallengeMetadata;
  editableColor: string;
  size: number;
  animationToken: number;
  // Which color of the logo the player is currently editing. Defaults to the
  // challenge's own `editableColorIndex`; multicolor mode overrides it per step.
  editableColorIndex?: number;
}

function ensureViewBox(svgXml: string): string {
  if (/\bviewBox\s*=/i.test(svgXml)) {
    return svgXml;
  }

  const width = svgXml.match(/<svg[^>]*?\bwidth="([\d.]+)/i)?.[1];
  const height = svgXml.match(/<svg[^>]*?\bheight="([\d.]+)/i)?.[1];

  if (!width || !height) {
    return svgXml;
  }

  return svgXml.replace(/<svg\b/i, `<svg viewBox="0 0 ${width} ${height}"`);
}

function sanitizeSvgXml(svgXml: string): string {
  const cleaned = svgXml
    .replace(/^<\?xml[^>]*\?>/i, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<!ENTITY[^>]*>/gi, "")
    .replace(/\s+xmlns:xlink="[^"]*"/gi, "")
    .trim();

  return ensureViewBox(cleaned);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceColorInSvg(
  svgXml: string,
  originalColor: string,
  replacementColor: string,
): string {
  const normalizedOriginal = normalizeHex(originalColor).toLowerCase();
  const normalizedReplacement = normalizeHex(replacementColor).toLowerCase();

  // Replace every occurrence of the source color literal, whether it appears
  // as an attribute (fill="#..."/stroke="#...") or inside an inline style
  // (style="fill:#...;stroke:#..."). The negative lookahead avoids matching a
  // longer hex value (e.g. an 8-digit color with alpha).
  const colorRegex = new RegExp(
    `${escapeRegExp(normalizedOriginal)}(?![0-9a-fA-F])`,
    "gi",
  );

  return sanitizeSvgXml(svgXml).replace(colorRegex, normalizedReplacement);
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
    // The color drawn in the SVG (`svgColor`) can differ from the color the
    // player must guess (`hex`). We replace the one actually present in the SVG.
    const sourceColor = editable?.svgColor ?? editable?.hex;

    if (!sourceColor) {
      return "";
    }

    return replaceColorInSvg(challenge.svgXml, sourceColor, editableColor);
  }, [challenge, editableColor, editableColorIndex]);

  // Pick a card background that keeps the artwork readable: dark logos (e.g.
  // Amazon or Starbucks) would blend into the default dark card, so we switch to
  // a light one. This is based on the challenge's true colors, not the color the
  // player is currently predicting, so the background stays stable while playing.
  const backgroundTheme = useMemo(
    () => getChallengeBackgroundTheme(challenge),
    [challenge],
  );

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.svgWrapper,
          {
            width: size,
            height: size,
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
            <Text style={styles.fallbackText}>SVG no disponible</Text>
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
    borderRadius: 28,
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
    color: "#A1A1AA",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
