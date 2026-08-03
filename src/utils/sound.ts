import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import { Platform } from "react-native";

import { SOUND_SOURCES, type SoundName } from "@/assets/audio";

/**
 * Sound-effect layer.
 *
 * Playback is fully driven by the registry in `assets/audio/index.ts`: to add a
 * sound you only import its file there. This module lazily builds a persistent
 * `AudioPlayer` per registered effect and replays it from the start on demand,
 * mirroring how `haptics.ts` provides tactile feedback. Every call is guarded so
 * a missing file, an unsupported platform (web) or a runtime error can never
 * throw during play.
 */

let audioModeConfigured = false;
let soundEnabled = true;

// One reusable player per effect so we don't re-decode the asset on every hit.
const players = new Map<SoundName, AudioPlayer>();

function isSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

function ensureAudioMode(): void {
  if (audioModeConfigured) {
    return;
  }
  audioModeConfigured = true;
  // Short SFX should mix with other audio and honour the device ringer switch.
  setAudioModeAsync({
    playsInSilentMode: false,
    interruptionMode: "mixWithOthers",
  }).catch(() => undefined);
}

function getPlayer(name: SoundName): AudioPlayer | null {
  const cached = players.get(name);
  if (cached) {
    return cached;
  }
  const source = SOUND_SOURCES[name];
  if (source == null) {
    return null;
  }
  try {
    const player = createAudioPlayer(source);
    players.set(name, player);
    return player;
  } catch {
    return null;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/**
 * Plays a registered effect. No-ops silently when sound is muted, the platform
 * has no audio support, or the effect has no imported file yet.
 */
export function playSound(name: SoundName): void {
  if (!soundEnabled || !isSupported()) {
    return;
  }
  if (SOUND_SOURCES[name] == null) {
    return;
  }
  ensureAudioMode();
  const player = getPlayer(name);
  if (!player) {
    return;
  }
  try {
    player.seekTo(0);
    player.play();
  } catch {
    // Ignore: audio is a nicety, never a hard failure.
  }
}

/**
 * Picks the sound that matches how well the player did, so audio reinforces the
 * result the same way haptics do.
 */
export function playScoreSound(score: number): void {
  playSound(score >= 90 ? "success" : "fail");
}
