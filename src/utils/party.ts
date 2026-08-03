import type {
  ChallengeMetadata,
  ChallengeStep,
  PartyConfig,
  PartyMode,
  PartyPlayer,
} from "@/types/challenge";
import challengeCatalog from "../../generated/challenges.json";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 99;

// Battle serves five shared images to every player.
export const BATTLE_IMAGES = 5;

// Seconds each player gets on their turn in the competitive timed mode
// (versus). Kept short and fixed so a run stays snappy for any player count.
export const BATTLE_TURN_SECONDS = 20;

// Cooperative timed mode: the per-player budget shrinks as the group grows so a
// big table doesn't drag on. It starts at 30 s for small groups and bottoms out
// at 20 s once there are lots of players.
export const COOP_TURN_SECONDS_MAX = 30;
export const COOP_TURN_SECONDS_MIN = 20;

// Timed modes cycle through a generous deck; if a player is fast enough to reach
// the end it simply wraps around.
const TIMED_DECK_SIZE = 60;

function getCatalog(): ChallengeMetadata[] {
  return (challengeCatalog as ChallengeMetadata[]).filter(
    (item) => item?.id && Array.isArray(item?.colors) && item.colors.length > 0,
  );
}

function toSingleColorStep(challenge: ChallengeMetadata): ChallengeStep | null {
  const colorIndex = challenge.editableColorIndex ?? 0;
  const target = challenge.colors[colorIndex];
  if (!target) {
    return null;
  }

  return {
    challenge: {
      ...challenge,
      svgXml: challenge.svgXml ?? "",
      editableColorIndex: colorIndex,
    },
    colorIndex,
    target,
    colorPosition: 1,
    colorCount: 1,
  };
}

function allSteps(): ChallengeStep[] {
  return getCatalog()
    .map(toSingleColorStep)
    .filter((step): step is ChallengeStep => step != null);
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Distinct images where possible; if the catalog is smaller than `count` the
// shuffled list is repeated so a run can always be assembled.
function pickUniqueSteps(count: number): ChallengeStep[] {
  const steps = shuffle(allSteps());
  if (steps.length === 0) {
    return [];
  }
  const result: ChallengeStep[] = [];
  while (result.length < count) {
    result.push(...steps);
  }
  return result.slice(0, count);
}

// Random images with repetition allowed (used by coop and the timed decks; the
// brief explicitly allows an image to come up more than once).
function pickStepsAllowRepeat(count: number): ChallengeStep[] {
  const steps = allSteps();
  if (steps.length === 0) {
    return [];
  }
  const result: ChallengeStep[] = [];
  for (let i = 0; i < count; i += 1) {
    result.push(steps[Math.floor(Math.random() * steps.length)]);
  }
  return result;
}

export function clampPlayers(count: number): number {
  if (!Number.isFinite(count)) {
    return MIN_PLAYERS;
  }
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.round(count)));
}

// How many images each player guesses in the (non-timed) collaborative mode.
// Fewer players means more images each so the run stays substantial; with lots
// of players a single image each keeps the whole match reasonable.
export function coopImagesPerPlayer(players: number): number {
  if (players <= 9) {
    return 3;
  }
  if (players <= 25) {
    return 2;
  }
  return 1;
}

export function isCooperativeMode(mode: PartyMode): boolean {
  return mode === "coop" || mode === "coop-timed";
}

export function isTimedMode(mode: PartyMode): boolean {
  return mode === "battle-timed" || mode === "coop-timed";
}

// Seconds each player gets on their turn in a timed mode. Versus (battle-timed)
// is a fixed short sprint; cooperative scales down with the number of players.
export function coopTurnSeconds(players: number): number {
  if (players <= 4) {
    return COOP_TURN_SECONDS_MAX; // 30 s
  }
  if (players <= 8) {
    return 25;
  }
  return COOP_TURN_SECONDS_MIN; // 20 s
}

export function turnSecondsFor(mode: PartyMode, players: number): number {
  if (mode === "battle-timed") {
    return BATTLE_TURN_SECONDS;
  }
  if (mode === "coop-timed") {
    return coopTurnSeconds(players);
  }
  return 0;
}

export function buildPartyConfig(
  mode: PartyMode,
  players: PartyPlayer[],
): PartyConfig {
  const cooperative = isCooperativeMode(mode);
  const timed = isTimedMode(mode);
  const imagesPerPlayer =
    cooperative && !timed ? coopImagesPerPlayer(players.length) : 0;

  let sharedSteps: ChallengeStep[] = [];
  let deck: ChallengeStep[] = [];
  let perPlayerSteps: ChallengeStep[][] = [];

  if (mode === "battle") {
    sharedSteps = pickUniqueSteps(BATTLE_IMAGES);
  } else if (timed) {
    deck = pickStepsAllowRepeat(TIMED_DECK_SIZE);
  } else if (mode === "coop") {
    perPlayerSteps = players.map(() => pickStepsAllowRepeat(imagesPerPlayer));
  }

  return {
    mode,
    cooperative,
    timed,
    players,
    imagesPerPlayer,
    turnSeconds: timed ? turnSecondsFor(mode, players.length) : 0,
    sharedSteps,
    deck,
    perPlayerSteps,
  };
}

// ---------------------------------------------------------------------------
// In-memory hand-off between the setup screen and the gameplay screen.
//
// Player names (up to 99) and the fixed image lists would be awkward to pass
// through URL params, so the setup screen stashes the built config here and the
// gameplay screen reads it back.
// ---------------------------------------------------------------------------

let pendingConfig: PartyConfig | null = null;

export function setPartyConfig(config: PartyConfig): void {
  pendingConfig = config;
}

export function getPartyConfig(): PartyConfig | null {
  return pendingConfig;
}

export function clearPartyConfig(): void {
  pendingConfig = null;
}
