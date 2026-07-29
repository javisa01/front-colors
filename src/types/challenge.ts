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
