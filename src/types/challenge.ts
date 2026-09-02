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
  // Every literal the SVG uses to paint this color. A single guessable color can
  // be drawn with several near-identical literals (`#000000` next to `#020202`,
  // or the same tone written as `#fff` and `rgb(255,255,255)`); all of them have
  // to be swapped or the logo repaints only halfway. `svgColor` is kept as the
  // first entry so older generated data still works.
  svgColors?: string[];
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

/**
 * Offline multiplayer ("party") modes, all played by passing a single phone
 * between players.
 * - `battle`: 5 shared images, everyone guesses each one in turns, per-image
 *   and overall ranking.
 * - `battle-timed`: one minute per player on the same deck, most points wins.
 * - `coop`: each player guesses a few images; all percentages are added into a
 *   single shared team score.
 * - `coop-timed`: one minute per player, everything summed into a team score.
 */
export type PartyMode = "battle" | "battle-timed" | "coop" | "coop-timed";

export interface PartyPlayer {
  id: number;
  name: string;
}

/**
 * Everything a party run needs. Built once in the setup screen and handed to
 * the gameplay screen so the images are fixed for the whole match.
 */
export interface PartyConfig {
  mode: PartyMode;
  cooperative: boolean;
  timed: boolean;
  players: PartyPlayer[];
  // Coop (non-timed): how many images each player guesses.
  imagesPerPlayer: number;
  // Timed modes: seconds each player gets on their turn.
  turnSeconds: number;
  // Battle (non-timed): the same images everyone guesses, in order.
  sharedSteps: ChallengeStep[];
  // Timed modes: shared deck each player cycles through during their turn.
  deck: ChallengeStep[];
  // Coop (non-timed): the images assigned to each player.
  perPlayerSteps: ChallengeStep[][];
}
