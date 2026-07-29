export interface HSVColor {
  h: number;
  s: number;
  v: number;
}

export interface ChallengeColor {
  hex: string;
  hsv: HSVColor;
  // Color literal actually present in the SVG that must be swapped for the
  // user's selection. Defaults to `hex` when omitted (useful when the color to
  // guess differs from the one drawn in the SVG).
  svgColor?: string;
}

export interface ChallengeMetadata {
  id: string;
  svg: string;
  svgXml: string;
  editableColorIndex?: number;
  colors: ChallengeColor[];
}

export interface ChallengeManifestEntry {
  id: string;
  colors: number;
}

/**
 * Playable game modes.
 * - `quick`: practice run, a handful of random single-color logos.
 * - `timed`: beat the clock, keep a streak going.
 * - `daily`: one deterministic challenge per calendar day.
 * - `multicolor`: rebuild every color of a single multi-color logo.
 */
export type GameMode = "quick" | "timed" | "daily" | "multicolor";

/**
 * A single thing the player has to guess. For single-color modes each challenge
 * contributes one step; in multicolor mode a challenge contributes one step per
 * color. Flattening challenges into steps keeps the game loop identical across
 * every mode.
 */
export interface ChallengeStep {
  challenge: ChallengeMetadata;
  colorIndex: number;
  target: ChallengeColor;
  // 1-based position of this color within its challenge and the total number of
  // colors in the challenge (used by the multicolor UI: "Color 2 de 4").
  colorPosition: number;
  colorCount: number;
}
