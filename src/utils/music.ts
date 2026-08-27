import { createAudioPlayer, type AudioPlayer } from "expo-audio";

import { MUSIC_SOURCE } from "@/assets/audio";
import {
  ensureAudioSession,
  playSafely,
  whenAudioAllowed,
} from "@/utils/audioSession";

// The player is stored on globalThis so it survives Fast Refresh module
// re-evaluation. Without this, a dev reload resets the module-level reference
// while the native player keeps playing, and startMusic() would spawn a second
// overlapping track.
const globalRef = globalThis as typeof globalThis & {
  __colorquestMusicPlayer?: AudioPlayer | null;
  __colorquestMusicVolume?: number;
  __colorquestMusicPending?: boolean;
};

function getPlayer(): AudioPlayer | null {
  return globalRef.__colorquestMusicPlayer ?? null;
}

function getVolume(): number {
  return globalRef.__colorquestMusicVolume ?? 0.5;
}

/**
 * Arranca la música de fondo.
 *
 * En web no suena en el momento de llamar: la app pide la música al montar el
 * layout raíz, cuando el navegador todavía no permite reproducir nada, así que
 * la petición queda en espera y se cumple sola en el primer toque. En nativo
 * arranca al instante. El reproductor no se crea hasta ese momento, para no
 * dejar un `<audio>` colgado si el jugador nunca llega a interactuar.
 */
export function startMusic(): void {
  if (getPlayer() || globalRef.__colorquestMusicPending) {
    return;
  }
  globalRef.__colorquestMusicPending = true;

  whenAudioAllowed(() => {
    globalRef.__colorquestMusicPending = false;
    if (getPlayer()) {
      return;
    }

    try {
      // La sesión de audio la configura `audioSession.ts`, compartida con los
      // efectos: si cada módulo la ajustase por su cuenta, la última llamada en
      // resolver decidiría el modo efectivo de toda la app.
      ensureAudioSession();

      const player = createAudioPlayer(MUSIC_SOURCE);
      player.loop = true;
      player.volume = getVolume();
      playSafely(player);
      globalRef.__colorquestMusicPlayer = player;
    } catch {
      globalRef.__colorquestMusicPlayer = null;
    }
  });
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
