import { useCallback, useEffect, useMemo, useReducer } from "react";

import type { ChallengeStep, PartyConfig } from "@/types/challenge";

/**
 * Phases of a party run:
 * - `handoff`: pass the phone to the next player (hides the board).
 * - `playing`: the active player guesses.
 * - `guessResult`: private per-guess feedback (own score only, never the
 *   correct color, so passing the phone can't reveal the answer).
 * - `roundResult`: battle only — once every player guessed one image, reveal
 *   the correct color and rank that image.
 * - `final`: overall ranking (competitive) or team score (cooperative).
 */
export type PartyPhase =
  | "handoff"
  | "playing"
  | "guessResult"
  | "roundResult"
  | "final";

export interface PartyGuess {
  player: number;
  slot: number;
  score: number;
  targetHex: string;
  guessHex: string;
}

interface PartyState {
  phase: PartyPhase;
  playerIndex: number;
  // Battle: index of the shared image. Coop: index within the player's images.
  slot: number;
  // Timed modes: position in the shared deck for the current turn.
  deckPos: number;
  timeLeft: number;
  lastScore: number;
  guesses: PartyGuess[];
}

type PartyAction =
  | { type: "BEGIN_TURN" }
  | { type: "SUBMIT"; score: number; targetHex: string; guessHex: string }
  | { type: "PROCEED" }
  | { type: "TICK" };

function initState(config: PartyConfig): PartyState {
  return {
    phase: "handoff",
    playerIndex: 0,
    slot: 0,
    deckPos: 0,
    timeLeft: config.turnSeconds,
    lastScore: 0,
    guesses: [],
  };
}

function makeReducer(config: PartyConfig) {
  const playerCount = config.players.length;

  return function reducer(state: PartyState, action: PartyAction): PartyState {
    switch (action.type) {
      case "BEGIN_TURN": {
        if (config.timed) {
          return {
            ...state,
            phase: "playing",
            timeLeft: config.turnSeconds,
            deckPos: 0,
          };
        }
        return { ...state, phase: "playing" };
      }

      case "SUBMIT": {
        const guess: PartyGuess = {
          player: state.playerIndex,
          slot: config.timed ? state.deckPos : state.slot,
          score: action.score,
          targetHex: action.targetHex,
          guessHex: action.guessHex,
        };
        const guesses = [...state.guesses, guess];

        if (config.timed) {
          // Keep playing; the countdown ends the turn.
          return {
            ...state,
            guesses,
            deckPos: state.deckPos + 1,
            lastScore: action.score,
          };
        }

        if (config.mode === "battle") {
          const isLastPlayer = state.playerIndex >= playerCount - 1;
          return {
            ...state,
            guesses,
            lastScore: action.score,
            // Last player finishes the image → reveal it; otherwise show the
            // current player their own score before handing off.
            phase: isLastPlayer ? "roundResult" : "guessResult",
          };
        }

        // Coop (non-timed): always show private feedback, then decide in PROCEED.
        return {
          ...state,
          guesses,
          lastScore: action.score,
          phase: "guessResult",
        };
      }

      case "PROCEED": {
        if (state.phase === "guessResult") {
          if (config.mode === "battle") {
            return {
              ...state,
              phase: "handoff",
              playerIndex: state.playerIndex + 1,
            };
          }

          // Coop (non-timed).
          if (state.slot < config.imagesPerPlayer - 1) {
            return { ...state, phase: "playing", slot: state.slot + 1 };
          }
          if (state.playerIndex < playerCount - 1) {
            return {
              ...state,
              phase: "handoff",
              playerIndex: state.playerIndex + 1,
              slot: 0,
            };
          }
          return { ...state, phase: "final" };
        }

        if (state.phase === "roundResult") {
          if (state.slot < config.sharedSteps.length - 1) {
            return {
              ...state,
              phase: "handoff",
              slot: state.slot + 1,
              playerIndex: 0,
            };
          }
          return { ...state, phase: "final" };
        }

        return state;
      }

      case "TICK": {
        if (state.phase !== "playing" || !config.timed) {
          return state;
        }
        const timeLeft = state.timeLeft - 1;
        if (timeLeft > 0) {
          return { ...state, timeLeft };
        }
        if (state.playerIndex < playerCount - 1) {
          return {
            ...state,
            phase: "handoff",
            playerIndex: state.playerIndex + 1,
            timeLeft: 0,
          };
        }
        return { ...state, phase: "final", timeLeft: 0 };
      }

      default:
        return state;
    }
  };
}

function selectCurrentStep(
  config: PartyConfig,
  state: PartyState,
): ChallengeStep | null {
  switch (config.mode) {
    case "battle":
      return config.sharedSteps[state.slot] ?? null;
    case "coop":
      return config.perPlayerSteps[state.playerIndex]?.[state.slot] ?? null;
    case "battle-timed":
    case "coop-timed": {
      if (config.deck.length === 0) {
        return null;
      }
      return config.deck[state.deckPos % config.deck.length];
    }
    default:
      return null;
  }
}

export interface UsePartyResult {
  config: PartyConfig;
  phase: PartyPhase;
  playerIndex: number;
  slot: number;
  deckPos: number;
  timeLeft: number;
  lastScore: number;
  currentStep: ChallengeStep | null;
  guesses: PartyGuess[];
  // Progress within the current player's turn (guesses already made this turn).
  turnSolved: number;
  turnScore: number;
  beginTurn: () => void;
  submitGuess: (score: number, targetHex: string, guessHex: string) => void;
  proceed: () => void;
}

export function useParty(config: PartyConfig): UsePartyResult {
  const reducer = useMemo(() => makeReducer(config), [config]);
  const [state, dispatch] = useReducer(reducer, config, initState);

  const beginTurn = useCallback(() => dispatch({ type: "BEGIN_TURN" }), []);
  const submitGuess = useCallback(
    (score: number, targetHex: string, guessHex: string) =>
      dispatch({ type: "SUBMIT", score, targetHex, guessHex }),
    [],
  );
  const proceed = useCallback(() => dispatch({ type: "PROCEED" }), []);

  // Countdown for timed modes. Recreated each second, mirroring the solo game.
  useEffect(() => {
    if (!config.timed || state.phase !== "playing") {
      return;
    }
    const id = setTimeout(() => dispatch({ type: "TICK" }), 1000);
    return () => clearTimeout(id);
  }, [config.timed, state.phase, state.timeLeft]);

  const currentStep = useMemo(
    () => selectCurrentStep(config, state),
    [config, state],
  );

  const { turnSolved, turnScore } = useMemo(() => {
    let solved = 0;
    let score = 0;
    for (const guess of state.guesses) {
      if (guess.player === state.playerIndex) {
        solved += 1;
        score += guess.score;
      }
    }
    // For timed modes each player's turn is a fresh run, and playerIndex only
    // moves forward, so counting this player's guesses is correct.
    return { turnSolved: solved, turnScore: score };
  }, [state.guesses, state.playerIndex]);

  return {
    config,
    phase: state.phase,
    playerIndex: state.playerIndex,
    slot: state.slot,
    deckPos: state.deckPos,
    timeLeft: state.timeLeft,
    lastScore: state.lastScore,
    currentStep,
    guesses: state.guesses,
    turnSolved,
    turnScore,
    beginTurn,
    submitGuess,
    proceed,
  };
}
