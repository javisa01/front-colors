import type { HSVColor } from "@/types/challenge";

/**
 * Geometría del selector de color: de coordenadas del dedo a HSV.
 *
 * Vive fuera del componente por dos razones. La primera es que así se puede
 * probar de verdad: el bug que arregla esta refactorización era una propiedad de
 * la máquina de estados, no del pintado, y una propiedad se comprueba con tests,
 * no mirando la pantalla. La segunda es que `ColorWheel` la ejecuta en el hilo
 * de UI — de ahí las directivas `"worklet"`, que hacen que el plugin de
 * Reanimated compile estas funciones para el runtime de la interfaz.
 *
 * La invariante que sostiene todo el módulo:
 *
 *   `applyValue` escribe en V y solo en V.
 *   `applyHueSaturation` escribe en H y S y solo en H y S.
 *
 * Ningún camino reconstruye un canal a partir de los otros ni a partir de un
 * color de 8 bits, que es exactamente lo que hacía la librería anterior y por lo
 * que el tono se perdía con saturaciones bajas.
 */

/** Resultado de tocar la rueda: solo tono y saturación. */
export interface HueSaturation {
  h: number;
  s: number;
}

/**
 * Lleva un tono al rango [0, 360) **sin tocarlo si ya está dentro**.
 *
 * La forma habitual, `((h % 360) + 360) % 360`, parece inofensiva pero mete
 * error de coma flotante en valores que no lo necesitaban: con `h = 274.8` da
 * `274.79999999999995`. Aplicado en cada frame de un gesto eso es deriva
 * acumulada — justo la clase de fuga que hace que un color "se mueva solo".
 */
function normalizeHue(h: number): number {
  "worklet";
  if (h >= 0 && h < 360) {
    // `Math.atan2(-0, x)` devuelve -0. Aritméticamente da igual, pero se
    // arrastraría hasta una etiqueta y se leería como «-0°».
    return h === 0 ? 0 : h;
  }
  const wrapped = h % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Convierte un punto dentro de la rueda en tono y saturación.
 *
 * El tono es el ángulo medido en sentido antihorario desde el este; la
 * saturación es la distancia al centro normalizada al radio. Tocar fuera del
 * disco satura al máximo en vez de descartar el gesto: si el dedo se sale del
 * círculo mientras arrastra, el selector debe seguir obedeciendo.
 *
 * @param x        Coordenada X relativa a la esquina de la rueda.
 * @param y        Coordenada Y relativa a la esquina de la rueda.
 * @param radius   Radio de la rueda en píxeles.
 */
export function pointToHueSaturation(
  x: number,
  y: number,
  radius: number,
): HueSaturation {
  "worklet";

  const dx = x - radius;
  const dy = y - radius;

  // El eje Y de la pantalla crece hacia abajo; se invierte para que el ángulo
  // avance en sentido antihorario como en una rueda de color canónica.
  const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
  const distance = Math.sqrt(dx * dx + dy * dy);

  return {
    h: normalizeHue(angle),
    s: Math.min(100, (distance / radius) * 100),
  };
}

/**
 * Convierte la posición vertical del dedo en el deslizador en brillo.
 *
 * Arriba es 100, abajo es 0. Devuelve un número, no un color: es imposible que
 * esta función toque el tono o la saturación porque no los recibe.
 *
 * @param y          Coordenada Y relativa al extremo superior del deslizador.
 * @param travel     Recorrido útil (alto total menos el pulgar).
 * @param thumbSize  Tamaño del pulgar, para centrarlo bajo el dedo.
 */
export function pointToValue(
  y: number,
  travel: number,
  thumbSize: number,
): number {
  "worklet";

  if (travel <= 0) {
    return 100;
  }

  const offset = Math.min(travel, Math.max(0, y - thumbSize / 2));
  return 100 - (offset / travel) * 100;
}

/**
 * Aplica un cambio de brillo a un color.
 *
 * Es la operación que estaba rota. Se deja explícita y con nombre para que la
 * invariante quede escrita en el código y no solo en un comentario: el color de
 * salida conserva `h` y `s` **bit a bit**, sea cual sea la saturación —
 * incluida `s = 0`, donde el tono es matemáticamente ambiguo pero debe
 * mantenerse igualmente para que el comportamiento sea intuitivo.
 */
export function applyValue(color: HSVColor, v: number): HSVColor {
  "worklet";
  return { h: color.h, s: color.s, v: Math.min(100, Math.max(0, v)) };
}

/**
 * Aplica un cambio de tono y saturación conservando el brillo actual.
 *
 * Simétrica de `applyValue`: mover la rueda nunca altera el brillo elegido.
 */
export function applyHueSaturation(
  color: HSVColor,
  next: HueSaturation,
): HSVColor {
  "worklet";
  return {
    h: normalizeHue(next.h),
    s: Math.min(100, Math.max(0, next.s)),
    v: color.v,
  };
}
