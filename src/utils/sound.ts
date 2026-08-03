import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";

import { SOUND_SOURCES, type SoundName } from "@/assets/audio";

/**
 * Sound-effect layer.
 *
 * Playback is fully driven by the registry in `assets/audio/index.ts`: to add a
 * sound you only import its file there. This module lazily builds a persistent
 * `AudioPlayer` per registered effect and replays it from the start on demand,
 * mirroring how `haptics.ts` provides tactile feedback. Every call is guarded so
 * a missing file or a runtime error can never throw during play.
 */

let audioModeConfigured = false;
let soundEnabled = true;
let sfxVolume = 1.0;

// One reusable player per effect so we don't re-decode the asset on every hit.
const players = new Map<SoundName, AudioPlayer>();

function ensureAudioMode(): void {
  if (audioModeConfigured) {
    return;
  }
  audioModeConfigured = true;
  // playsInSilentMode: true so effects are still audible when the iOS ringer
  // switch is set to silent.
  setAudioModeAsync({
    playsInSilentMode: true,
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
    player.volume = sfxVolume;
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

export function setSfxVolume(volume: number): void {
  sfxVolume = Math.max(0, Math.min(1, volume));
  for (const p of players.values()) {
    p.volume = sfxVolume;
  }
}

export function getSfxVolume(): number {
  return sfxVolume;
}

/**
 * Plays a registered effect. No-ops silently when sound is muted or the effect
 * has no imported file yet.
 */
export function playSound(name: SoundName): void {
  if (!soundEnabled) {
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
 * result the same way haptics do. Below 60 counts as a miss.
 */
export function playScoreSound(score: number): void {
  playSound(score < 60 ? "fail" : "success");
}

/** Short click feedback for buttons and other tappable elements. */
export function playTick(): void {
  playSound("tick");
}
