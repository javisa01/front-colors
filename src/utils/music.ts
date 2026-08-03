import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";

import { MUSIC_SOURCE } from "@/assets/audio";

// The player is stored on globalThis so it survives Fast Refresh module
// re-evaluation. Without this, a dev reload resets the module-level reference
// while the native player keeps playing, and startMusic() would spawn a second
// overlapping track.
const globalRef = globalThis as typeof globalThis & {
  __colorquestMusicPlayer?: AudioPlayer | null;
  __colorquestMusicVolume?: number;
};

function getPlayer(): AudioPlayer | null {
  return globalRef.__colorquestMusicPlayer ?? null;
}

function getVolume(): number {
  return globalRef.__colorquestMusicVolume ?? 0.5;
}

export function startMusic(): void {
  if (getPlayer()) {
    return;
  }
  try {
    // playsInSilentMode: true is required so the track plays even when the
    // iOS ringer switch is set to silent. shouldPlayInBackground keeps the
    // ambience alive when the app is backgrounded.
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "mixWithOthers",
    }).catch(() => undefined);

    const player = createAudioPlayer(MUSIC_SOURCE);
    player.loop = true;
    player.volume = getVolume();
    player.play();
    globalRef.__colorquestMusicPlayer = player;
  } catch {
    globalRef.__colorquestMusicPlayer = null;
  }
}

export function setMusicVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume));
  globalRef.__colorquestMusicVolume = clamped;
  const player = getPlayer();
  if (player) {
    player.volume = clamped;
  }
}

export function getMusicVolume(): number {
  return getVolume();
}
