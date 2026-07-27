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
import { normalizeHex } from "@/utils/color";

interface SVGChallengeProps {
  challenge: ChallengeMetadata;
  editableColor: string;
  size: number;
  animationToken: number;
}

function sanitizeSvgXml(svgXml: string): string {
  return svgXml
    .replace(/^<\?xml[^>]*\?>/i, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<!ENTITY[^>]*>/gi, "")
    .replace(/\s+xmlns:xlink="[^"]*"/gi, "")
    .trim();
}

function replaceColorInSvg(
  svgXml: string,
  originalColor: string,
  replacementColor: string,
): string {
  const normalizedOriginal = normalizeHex(originalColor).toLowerCase();
  const normalizedReplacement = normalizeHex(replacementColor).toLowerCase();

  return sanitizeSvgXml(svgXml).replace(
    /\b(fill|stroke)=(["'])(.*?)\2/gi,
    (match, attribute, quote, value) => {
      if (value.trim().toLowerCase() === normalizedOriginal) {
        return `${attribute}=${quote}${normalizedReplacement}${quote}`;
      }

      return match;
    },
  );
}

function SVGChallenge({
  challenge,
  editableColor,
  size,
  animationToken,
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
    const targetColor =
      challenge.colors?.[challenge.editableColorIndex ?? 0]?.hex;

    if (!targetColor) {
      return "";
    }

    return replaceColorInSvg(challenge.svgXml, targetColor, editableColor);
  }, [challenge, editableColor]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.svgWrapper,
          { width: size, height: size },
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
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "#27272A",
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
