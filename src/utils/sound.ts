import { createAudioPlayer, type AudioPlayer } from "expo-audio";

import { SOUND_SOURCES, type SoundName } from "@/assets/audio";
import { ensureAudioSession, playSafely } from "@/utils/audioSession";
import { isHit } from "@/utils/colorScore";

/**
 * Capa de efectos de sonido.
 *
 * ## El problema que resuelve
 *
 * La versión anterior guardaba **un único `AudioPlayer` por efecto** y lo
 * reiniciaba en cada disparo:
 *
 * ```ts
 * player.seekTo(0);   // devuelve Promise<void> — nadie la esperaba
 * player.play();
 * ```
 *
 * De ahí salían dos fallos distintos ante CLICK → CLICK → CLICK → CLICK:
 *
 * 1. **Corte del sonido en curso.** Al haber una sola voz, el segundo click
 *    rebobinaba el mismo reproductor que aún estaba sonando. En vez de dos
 *    clicks se oía uno partido por la mitad.
 * 2. **Carrera entre `seekTo` y `play`.** `seekTo` es asíncrono. Al no esperarlo,
 *    `play()` podía ejecutarse *antes* de que el rebobinado se hubiese aplicado,
 *    así que el reproductor arrancaba desde una posición indeterminada — a veces
 *    desde el final, y entonces no sonaba nada.
 *
 * ## La solución
 *
 * Un **pool de voces por efecto**, como en cualquier motor de audio de juego.
 * Cada disparo toma una voz libre, y solo si no queda ninguna se recicla la más
 * antigua (ahí sí esperando el `seekTo`). Con voces libres el disparo es
 * inmediato y sin rebobinado: los clicks rápidos se solapan de forma natural en
 * lugar de cortarse, y el tamaño del pool acota cuántos pueden sonar a la vez.
 *
 * No hay ningún `debounce` por tiempo salvo la ventana de fusión acústica que se
 * documenta en `RETRIGGER_FLOOR_MS`, que existe por una razón física concreta y
 * no para ocultar el problema.
 */

let soundEnabled = true;
let sfxVolume = 1.0;

/**
 * Voces por efecto.
 *
 * `tick` recibe más porque es el único que el usuario puede disparar en ráfaga.
 * Cuatro voces cubren de sobra un tecleo humano rápido y a la vez impiden que
 * veinte pulsaciones seguidas se acumulen en un muro de ruido: pasadas las
 * cuatro, la más antigua se recicla, que es exactamente el comportamiento
 * "estable y predecible" que se busca.
 */
const POOL_SIZE: Record<SoundName, number> = {
  tick: 4,
  success: 2,
  fail: 2,
  gameOver: 1,
};

/**
 * Dos disparos del mismo efecto separados por menos de esto no se perciben como
 * dos sonidos: se superponen casi en fase y producen filtrado en peine, que se
 * oye como un chasquido metálico en vez de como dos clicks. Fundirlos es lo que
 * hace un motor de audio, no una forma de descartar pulsaciones — el doble toque
 * humano más rápido ronda los 120 ms, muy por encima de este suelo.
 */
const RETRIGGER_FLOOR_MS = 25;

interface Voice {
  player: AudioPlayer;
  /** Momento en que se lanzó, para reciclar siempre la voz más antigua. */
  startedAt: number;
}

interface Pool {
  voices: Voice[];
  /** Siguiente voz a inspeccionar. Reparte el uso en lugar de castigar la 0. */
  cursor: number;
  lastPlayedAt: number;
}

const pools = new Map<SoundName, Pool>();

function getPool(name: SoundName): Pool | null {
  const cached = pools.get(name);
  if (cached) {
    return cached;
  }

  const source = SOUND_SOURCES[name];
  if (source == null) {
    return null;
  }

  try {
    const voices: Voice[] = [];
    for (let index = 0; index < POOL_SIZE[name]; index += 1) {
      const player = createAudioPlayer(source);
      player.volume = sfxVolume;
      voices.push({ player, startedAt: 0 });
    }

    const pool: Pool = { voices, cursor: 0, lastPlayedAt: 0 };
    pools.set(name, pool);
    return pool;
  } catch {
    return null;
  }
}

/**
 * Elige la voz a usar: la primera libre a partir del cursor y, si todas están
 * ocupadas, la que lleva más tiempo sonando (la que menos se nota al cortar).
 */
function takeVoice(pool: Pool): { voice: Voice; wasBusy: boolean } {
  const { voices } = pool;

  for (let offset = 0; offset < voices.length; offset += 1) {
    const index = (pool.cursor + offset) % voices.length;
    const voice = voices[index];
    if (!voice.player.playing) {
      pool.cursor = (index + 1) % voices.length;
      return { voice, wasBusy: false };
    }
  }

  let oldest = voices[0];
  for (const voice of voices) {
    if (voice.startedAt < oldest.startedAt) {
      oldest = voice;
    }
  }
  return { voice: oldest, wasBusy: true };
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSfxVolume(volume: number): void {
  sfxVolume = Math.max(0, Math.min(1, volume));
  for (const pool of pools.values()) {
    for (const voice of pool.voices) {
      voice.player.volume = sfxVolume;
    }
  }
}

export function getSfxVolume(): number {
  return sfxVolume;
}

/**
 * Dispara un efecto. No hace nada —sin lanzar— si el sonido está silenciado, el
 * volumen es cero o el efecto todavía no tiene fichero registrado.
 */
export function playSound(name: SoundName): void {
  if (!soundEnabled || sfxVolume <= 0) {
    return;
  }
  if (SOUND_SOURCES[name] == null) {
    return;
  }

  ensureAudioSession();

  const pool = getPool(name);
  if (!pool) {
    return;
  }

  const now = Date.now();
  if (now - pool.lastPlayedAt < RETRIGGER_FLOOR_MS) {
    return;
  }
  pool.lastPlayedAt = now;

  const { voice, wasBusy } = takeVoice(pool);
  voice.startedAt = now;

  if (!wasBusy) {
    // Camino habitual: la voz está parada, así que ya se encuentra al inicio
    // (o terminó de sonar). Se lanza sin rebobinar — sin latencia y sin esperar
    // a nada.
    playSafely(voice.player);
    return;
  }

  // Todas las voces ocupadas: hay que reciclar. Aquí el rebobinado sí es
  // necesario, y ahora sí se espera antes de reproducir, que es justo lo que
  // faltaba antes.
  try {
    voice.player.pause();
    voice.player
      .seekTo(0)
      .then(() => {
        playSafely(voice.player);
      })
      .catch(() => undefined);
  } catch {
    // El audio es un adorno; nunca debe tumbar una interacción.
  }
}

/**
 * Elige el sonido acorde al resultado, igual que `feedbackForScore` elige la
 * vibración. El umbral es el mismo «acierto» que usan el marcador y la racha.
 */
export function playScoreSound(score: number): void {
  playSound(isHit(score) ? "success" : "fail");
}

/** Click corto para botones y elementos pulsables. */
export function playTick(): void {
  playSound("tick");
}

/** Cierre de partida. */
export function playGameOver(): void {
  playSound("gameOver");
}
