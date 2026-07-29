import convert from "color-convert";

import type { ChallengeMetadata, HSVColor } from "@/types/challenge";

export function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

export function hexToHSV(hex: string): HSVColor {
  const rgb = convert.hex.rgb(hex.replace("#", ""));
  const [h, s, v] = convert.rgb.hsv(rgb);
  return { h, s, v };
}

// CIELAB representation of an HSV color. Used by the perceptual color-distance
// scoring (CIEDE2000), which lives in `colorScore.ts`. Lab keeps the math in a
// space that matches how the human eye judges color differences far better than
// raw HSV does.
export function hsvToLab(hsv: HSVColor): [number, number, number] {
  const [l, a, b] = convert.hsv.lab([hsv.h, hsv.s, hsv.v]);
  return [l, a, b];
}

export function hsvToHex(h: number, s: number, v: number): string {
  const [r, g, b] = convert.hsv.rgb([h, s, v]);
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function normalizeHex(hex: string): string {
  const value = hex.replace("#", "").toUpperCase();
  return `#${value}`;
}

export function isWithinTolerance(
  selected: HSVColor,
  target: HSVColor,
  tolerance: HSVColor,
): boolean {
  return (
    hueDistance(selected.h, target.h) <= tolerance.h &&
    Math.abs(selected.s - target.s) <= tolerance.s &&
    Math.abs(selected.v - target.v) <= tolerance.v
  );
}

// A handful of named colors commonly found in raw SVG assets. We only need the
// ones that matter for the dark/light background decision.
const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
};

function expandShortHex(hex: string): string {
  if (hex.length === 4) {
    // #rgb -> #rrggbb
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

// Relative luminance (WCAG) in the 0..1 range. 0 is black, 1 is white.
export function relativeLuminance(hex: string): number {
  const [r, g, b] = convert.hex
    .rgb(expandShortHex(hex).replace("#", ""))
    .map((channel) => {
      const value = channel / 255;
      return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function extractSvgColors(svgXml: string): string[] {
  const colors: string[] = [];

  // fill / stroke attributes and their inline-style equivalents.
  const attrRegex =
    /(?:fill|stroke)\s*[=:]\s*["']?\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)/g;

  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(svgXml)) !== null) {
    const raw = match[1].toLowerCase();

    if (raw === "none" || raw === "transparent" || raw === "currentcolor") {
      continue;
    }

    if (raw.startsWith("#")) {
      // Ignore 8-digit colors that are fully transparent (alpha === 00).
      if (raw.length === 9 && raw.slice(7) === "00") {
        continue;
      }
      colors.push(expandShortHex(raw.slice(0, 7)));
    } else if (NAMED_COLORS[raw]) {
      colors.push(NAMED_COLORS[raw]);
    }
  }

  return colors;
}

export interface SvgBackgroundTheme {
  background: string;
  border: string;
  isLight: boolean;
}

const DARK_THEME: SvgBackgroundTheme = {
  background: "#111113",
  border: "#27272A",
  isLight: false,
};

const LIGHT_THEME: SvgBackgroundTheme = {
  background: "#FAFAFA",
  border: "#E4E4E7",
  isLight: true,
};

// Decide which card background makes the artwork readable. When the SVG is made
// up mostly of dark colors (or its primary/secondary color is nearly black) the
// default dark card hides it, so we switch to a light background instead.
export function getSvgBackgroundTheme(svgXml: string): SvgBackgroundTheme {
  const colors = extractSvgColors(svgXml);

  if (colors.length === 0) {
    return DARK_THEME;
  }

  const DARK_LUMINANCE = 0.14; // dark colors that blend into the dark card

  const frequency = new Map<string, number>();
  for (const color of colors) {
    frequency.set(color, (frequency.get(color) ?? 0) + 1);
  }

  const ranked = [...frequency.entries()].sort((a, b) => b[1] - a[1]);
  const [primary, secondary] = ranked;

  const primaryIsDark =
    primary != null && relativeLuminance(primary[0]) <= DARK_LUMINANCE;
  const secondaryIsDark =
    secondary != null && relativeLuminance(secondary[0]) <= DARK_LUMINANCE;

  const darkCount = colors.reduce(
    (total, color) =>
      relativeLuminance(color) <= DARK_LUMINANCE ? total + 1 : total,
    0,
  );
  const darkRatio = darkCount / colors.length;

  if (primaryIsDark || secondaryIsDark || darkRatio >= 0.35) {
    return LIGHT_THEME;
  }

  return DARK_THEME;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceColorLiteral(
  svgXml: string,
  original: string,
  replacement: string,
): string {
  const from = normalizeHex(original).toLowerCase();
  const to = normalizeHex(replacement).toLowerCase();
  const regex = new RegExp(`${escapeRegExp(from)}(?![0-9a-fA-F])`, "gi");
  return svgXml.replace(regex, to);
}

// Decide the card background for a challenge based on its "true" logo: the fixed
// parts of the SVG plus the correct answer color for the editable piece. The
// live predicted color is intentionally ignored so the background stays stable
// while the player adjusts the color to guess.
export function getChallengeBackgroundTheme(
  challenge: ChallengeMetadata,
): SvgBackgroundTheme {
  if (!challenge.svgXml) {
    return DARK_THEME;
  }

  const editable = challenge.colors?.[challenge.editableColorIndex ?? 0];
  const sourceColor = editable?.svgColor ?? editable?.hex;
  const targetColor = editable?.hex;

  let svgXml = challenge.svgXml;
  if (
    sourceColor &&
    targetColor &&
    sourceColor.toLowerCase() !== targetColor.toLowerCase()
  ) {
    svgXml = replaceColorLiteral(svgXml, sourceColor, targetColor);
  }

  return getSvgBackgroundTheme(svgXml);
}
