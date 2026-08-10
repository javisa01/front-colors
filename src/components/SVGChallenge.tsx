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

// Expand CSS class-based fill/stroke rules to inline attributes so that
// react-native-svg applies them reliably and color replacement works.
function inlineCssColors(svgXml: string): string {
  const styleMatch = svgXml.match(
    /<style[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/style>/i,
  );
  if (!styleMatch) return svgXml;

  const cssText = styleMatch[1];
  const ruleRegex = /\.([a-zA-Z_][\w-]*)\s*\{([^}]*)\}/g;
  const classStyles: Record<string, { fill?: string; stroke?: string }> = {};

  let ruleMatch: RegExpExecArray | null;
  while ((ruleMatch = ruleRegex.exec(cssText)) !== null) {
    const className = ruleMatch[1];
    const body = ruleMatch[2];
    const fillVal = body.match(/(?:^|;)\s*fill\s*:\s*([^;}\s]+)/i)?.[1];
    const strokeVal = body.match(/(?:^|;)\s*stroke\s*:\s*([^;}\s]+)/i)?.[1];
    if (fillVal || strokeVal) {
      classStyles[className] = { fill: fillVal, stroke: strokeVal };
    }
  }

  let result = svgXml;
  for (const [className, props] of Object.entries(classStyles)) {
    const elRegex = new RegExp(
      `(<[a-zA-Z][^>]*\\bclass="[^"]*\\b${escapeRegExp(className)}\\b[^"]*"[^>]*?)(\\s*/?>)`,
      "gi",
    );
    result = result.replace(elRegex, (_full, before, close) => {
      let attrs = "";
      if (
        props.fill &&
        !/\bfill\s*=/i.test(before) &&
        !/\bstyle="[^"]*fill\s*:/i.test(before)
      ) {
        attrs += ` fill="${props.fill}"`;
      }
      if (
        props.stroke &&
        !/\bstroke\s*=/i.test(before) &&
        !/\bstyle="[^"]*stroke\s*:/i.test(before)
      ) {
        attrs += ` stroke="${props.stroke}"`;
      }
      return `${before}${attrs}${close}`;
    });
  }

  // Remove the now-redundant <style> block; react-native-svg does not apply
  // CSS classes and leaving raw CSS in the tree can break its parser.
  result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  return result;
}

function sanitizeSvgXml(svgXml: string): string {
  const cleaned = svgXml
    .replace(/^<\?xml[^>]*\?>/i, "")
    // Remove full DOCTYPE declarations, including internal subsets ([...]).
    .replace(/<!DOCTYPE[\s\S]*?(?:\]>|>)/gi, "")
    .replace(/<!ENTITY[^>]*>/gi, "")
    .replace(/^\s*\]>\s*/gm, "")
    .replace(/\bxlink:href\b/gi, "href")
    .replace(/\s+xmlns:xlink="[^"]*"/gi, "")
    // Drop authored alignment (e.g. "xMinYMin meet") so every logo falls back to
    // the default xMidYMid meet and stays centered inside the square card.
    .replace(/\s+preserveAspectRatio="[^"]*"/gi, "")
    .trim();

  return ensureViewBox(inlineCssColors(cleaned));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceColorInSvg(
  svgXml: string,
  originalColor: string,
  replacementColor: string,
): string {
  const normalizedReplacement = normalizeHex(replacementColor).toLowerCase();

  // The source color may be a hex literal (`#0060a8`), an `rgb()` string
  // (`rgb(0, 96, 168)`) or a CSS named color (`red`). Each needs a different
  // match: rgb() must be matched verbatim (flexible whitespace), hex avoids
  // matching a longer 8-digit value, and named colors are matched as whole
  // words so `red` doesn't swallow part of another token.
  const source = originalColor.trim();
  const isRgb = /^rgba?\(/i.test(source);
  const isHex = /^#?[0-9a-fA-F]{3,8}$/.test(source);
  const pattern = isRgb
    ? escapeRegExp(source).replace(/\\?\s+/g, "\\s*")
    : isHex
      ? `${escapeRegExp(normalizeHex(source).toLowerCase())}(?![0-9a-fA-F])`
      : `\\b${escapeRegExp(source.toLowerCase())}\\b`;

  const colorRegex = new RegExp(pattern, "gi");

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
