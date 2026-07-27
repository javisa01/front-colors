export interface HSVColor {
  h: number;
  s: number;
  v: number;
}

export interface ChallengeColor {
  hex: string;
  hsv: HSVColor;
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
