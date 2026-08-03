import type { AudioSource } from "expo-audio";

/**
 * Names of every sound effect the game knows how to play.
 * Add a new entry here (and a matching file below) to introduce a new effect.
 */
export type SoundName = "tick" | "success" | "fail" | "gameOver";

/**
 * Sound-effect registry.
 *
 * The whole point of this file: to add audio you ONLY need to
 *   1. Drop the audio file into `assets/audio/` (e.g. `success.mp3`).
 *   2. Uncomment (or add) the matching `require(...)` line below.
 *
 * Everything else — playback, throttling and muting — is already wired up in
 * `src/utils/sound.ts` and called from the game screens. Any sound whose file
 * is not registered here is silently ignored, so the app keeps working with no
 * audio at all until you drop the files in.
 *
 * Supported formats: `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg` (see the Expo audio
 * docs for the full per-platform list).
 */
export const SOUND_SOURCES: Partial<Record<SoundName, AudioSource>> = {
  // tick: require("./tick.mp3"),
  // success: require("./success.mp3"),
  // fail: require("./fail.mp3"),
  // gameOver: require("./game-over.mp3"),
};
