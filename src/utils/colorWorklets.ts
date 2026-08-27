/**
 * Conversiones de color ejecutables en el hilo de UI.
 *
 * Son copias deliberadas de la matemática de `color.ts` marcadas como
 * `worklet`, para que el picker pueda pintar el pulgar, la muestra y el
 * degradado del deslizador durante un gesto **sin volver a JavaScript** y sin
 * provocar un solo re-render por frame.
 *
 * Diferencia importante con `color.ts`: aquí NO se redondea a enteros hasta el
 * último paso, el de pasar a hexadecimal. `color.ts` usa `color-convert`, que
 * redondea H, S y V a enteros; encadenar esa conversión en cada frame de un
 * gesto acumula error. El estado del picker se mantiene en coma flotante y solo
 * se cuantiza al generar el color que se pinta.
 */

/** HSV (h 0-360, s 0-100, v 0-100) → RGB (0-255). */
export function hsvToRgbWorklet(
  h: number,
  s: number,
  v: number,
): { r: number; g: number; b: number } {
  "worklet";

  // Normalización sin deriva: un tono ya en rango se deja intacto en lugar de
  // pasarlo por `% 360` dos veces, que le añade error de coma flotante.
  let hue = h;
  if (hue < 0 || hue >= 360) {
    hue = h % 360;
    if (hue < 0) {
      hue += 360;
    }
  }

  const sat = Math.min(1, Math.max(0, s / 100));
  const val = Math.min(1, Math.max(0, v / 100));

  const sector = hue / 60;
  const index = Math.floor(sector);
  const frac = sector - index;

  const p = val * (1 - sat);
  const q = val * (1 - frac * sat);
  const t = val * (1 - (1 - frac) * sat);

  let r = 0;
  let g = 0;
  let b = 0;

  switch (index % 6) {
    case 0:
      r = val;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = val;
      b = p;
      break;
    case 2:
      r = p;
      g = val;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = val;
      break;
    case 4:
      r = t;
      g = p;
      b = val;
      break;
    default:
      r = val;
      g = p;
      b = q;
      break;
  }

  // `Math.round`, no `Math.floor`. La librería anterior truncaba aquí y
  // redondeaba al convertir de vuelta, así que cada ida y vuelta perdía valor de
  // forma sistemática y acumulativa.
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

const HEX_DIGITS = "0123456789ABCDEF";

function channelToHex(value: number): string {
  "worklet";
  const clamped = Math.min(255, Math.max(0, Math.round(value)));
  return HEX_DIGITS[clamped >> 4] + HEX_DIGITS[clamped & 15];
}

/** HSV → `#RRGGBB`. Único punto donde el color se cuantiza a 8 bits. */
export function hsvToHexWorklet(h: number, s: number, v: number): string {
  "worklet";
  const { r, g, b } = hsvToRgbWorklet(h, s, v);
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}
