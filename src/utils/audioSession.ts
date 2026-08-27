import { setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Platform } from "react-native";

/**
 * Configuración de la sesión de audio, en un único sitio.
 *
 * Antes `sound.ts` y `music.ts` llamaban cada uno a `setAudioModeAsync` con
 * opciones distintas al arrancar la app. Como las dos llamadas salen en el mismo
 * tick, el modo efectivo dependía de cuál resolviese la última: una carrera real
 * que hacía que `shouldPlayInBackground` quedase puesto o no según el arranque.
 * Ahora la sesión se configura una sola vez y ambos módulos piden lo mismo.
 *
 * Aquí vive además la puerta de la política de autoplay del navegador, que es lo
 * que decide *cuándo* se puede llamar a `play()` en web.
 */

let configured = false;

export function ensureAudioSession(): void {
  if (configured) {
    return;
  }
  configured = true;

  setAudioModeAsync({
    // Los efectos y la música deben oírse aunque el interruptor de silencio del
    // iPhone esté activado: el jugador ha subido el volumen a propósito desde
    // los ajustes de la app.
    playsInSilentMode: true,
    // La música es ambiente del juego, no un reproductor: al salir de la app se
    // calla en lugar de seguir sonando en segundo plano.
    shouldPlayInBackground: false,
    // Nunca interrumpimos lo que el usuario ya estuviese escuchando.
    interruptionMode: "mixWithOthers",
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Política de autoplay
// ---------------------------------------------------------------------------

/**
 * ## El error que esto arregla
 *
 * ```
 * Uncaught (in promise) DOMException: The play method is not allowed by the
 * user agent or the platform in the current context...
 * ```
 *
 * Los navegadores rechazan `HTMLMediaElement.play()` mientras el usuario no haya
 * interactuado con la página. La música arranca en el layout raíz, o sea antes
 * de que nadie haya tocado nada, así que el rechazo era seguro.
 *
 * Y no bastaba con capturar la promesa: el `play()` de `expo-audio` en web
 * (`AudioPlayerWeb.play`) llama a `this.media.play()` y **tira el resultado** —
 * su firma devuelve `void`. La promesa rechazada no llega hasta aquí, así que no
 * hay ningún sitio donde ponerle un `.catch()`. La única forma de que el error
 * no ocurra es no llamar a `play()` antes de tiempo.
 *
 * ## Cómo funciona
 *
 * En web nadie reproduce nada hasta el primer gesto del usuario. Lo que llegue
 * antes se encola y sale en cuanto ese gesto ocurre; en nativo no hay política
 * que valga y la puerta nace abierta.
 *
 * Los oyentes van en fase de captura sobre `window`, que se ejecuta antes que
 * los manejadores de React: para cuando el `onPress` de un botón llame a
 * `playTick()`, la puerta ya está abierta y el click suena en ese mismo toque,
 * sin perderse el primero.
 */
const IS_WEB = Platform.OS === "web";

/** El renderizado estático de web no tiene `window`; allí no suena nada. */
const HAS_DOM =
  IS_WEB &&
  typeof window !== "undefined" &&
  typeof window.addEventListener === "function";

/**
 * Qué cuenta como interacción. `pointerdown` cubre ratón y dedo en navegadores
 * modernos; `touchend` queda para los Safari viejos, que no consideran gesto un
 * `touchstart` que todavía puede acabar en scroll; `keydown` para quien navega
 * con el teclado y nunca llega a apuntar a nada.
 */
const GESTURE_EVENTS = ["pointerdown", "touchend", "keydown"] as const;

let allowed = !IS_WEB;
let pending: (() => void)[] = [];

function openGate(): void {
  if (allowed) {
    return;
  }
  allowed = true;

  if (HAS_DOM) {
    for (const type of GESTURE_EVENTS) {
      window.removeEventListener(type, openGate, true);
    }
  }

  // La cola se vacía antes de recorrerla: si algo de lo encolado volviese a
  // encolar, iría ya por el camino directo en lugar de crecer bajo los pies del
  // bucle.
  const queued = pending;
  pending = [];
  for (const start of queued) {
    try {
      start();
    } catch {
      // El audio es un adorno; nunca debe tumbar el arranque.
    }
  }
}

if (HAS_DOM) {
  for (const type of GESTURE_EVENTS) {
    window.addEventListener(type, openGate, { capture: true, passive: true });
  }
}

/**
 * Ejecuta `start` en cuanto el navegador permita reproducir: ya mismo si el
 * usuario ya ha tocado algo (siempre, en nativo), o en el primer gesto si no.
 *
 * Para sonidos que la app arranca por su cuenta —la música de fondo—. Un efecto
 * disparado por una pulsación no necesita esto: la pulsación *es* el gesto.
 */
export function whenAudioAllowed(start: () => void): void {
  if (allowed) {
    start();
    return;
  }
  pending.push(start);
}

/**
 * Arranca un reproductor sin que su fallo salga por la consola.
 *
 * Antes del primer gesto no se intenta siquiera: en web el navegador lo
 * rechazaría y en nativo la puerta ya está abierta desde el principio. El `try`
 * cubre el resto de fallos, que en nativo llegan como excepción síncrona.
 */
export function playSafely(player: AudioPlayer): void {
  if (!allowed) {
    return;
  }

  try {
    const started: unknown = player.play();
    // En nativo `play()` no devuelve nada. Si alguna versión web llegase a
    // devolver la promesa, aquí queda atendida.
    if (started instanceof Promise) {
      started.catch(() => undefined);
    }
  } catch {
    // El audio es un adorno; nunca debe tumbar una interacción.
  }
}
