import convert from "color-convert";

import type { ChallengeMetadata, HSVColor } from "@/types/challenge";
import { hsvToHexWorklet } from "@/utils/colorWorklets";

export function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

/**
 * Si un color del logo es sombra, contorno o gris de relleno en vez de un color
 * de marca. Dicho de otra manera: si **no se puede adivinar**.
 *
 * El caso que lo motivó fue Cockta —retirado del catálogo el 2026-09-24 por su
 * licencia, pero el ejemplo sigue explicando la regla—, que tenía rojo,
 * amarillo y un `#231F20` que era el contorno negro de las letras. En un modo que pide reconstruir *todos*
 * los colores del logo, ese tercero no es una jugada: el jugador no tiene que
 * mirar el logo ni recordar nada, solo bajar el brillo a cero, y da igual el
 * tono que deje puesto porque a esa oscuridad no se distingue ninguno. Lo mismo
 * con el gris del «Microsoft» de la marca de las cuatro ventanas.
 *
 * Dos condiciones, y ninguna sobra:
 *
 *  - **Oscuro y poco saturado.** Oscuro a secas no vale: el marrón de UPS
 *    (`v` 19, `s` 88) o el azul marino de Lufthansa (`v` 24, `s` 84) son
 *    colores de marca de pleno derecho y tienen tono que acertar.
 *  - **Gris, esté donde esté.** Un `#918F90` no se adivina ni a plena luz,
 *    porque no hay tono que buscar.
 *
 * El generador ya descarta el negro puro, el blanco y los grises al construir
 * el catálogo (`tools/generateMetadata.ts`), pero con umbrales más estrechos
 * —`v` ≤ 12 y `s` ≤ 8—, y por ahí se colaban estos. Esto no rehace el catálogo:
 * decide, al repartir, qué colores cuentan.
 */
export function isUnguessableColor(hsv: HSVColor): boolean {
  return (hsv.v <= 28 && hsv.s <= 45) || hsv.s <= 12;
}

export function hexToHSV(hex: string): HSVColor {
  const rgb = convert.hex.rgb(hex.replace("#", ""));
  const [h, s, v] = convert.rgb.hsv(rgb);
  return { h, s, v };
}

// CIELAB representation of an HSV color. Used by the perceptual color-distance
// scoring (CIEDE2000), which lives in `colorScore.ts`. Lab keeps the math in a
// space that matches how the human eye judges color differences far better than
// raw HSV does.
export function hsvToLab(hsv: HSVColor): [number, number, number] {
  const [l, a, b] = convert.hsv.lab([hsv.h, hsv.s, hsv.v]);
  return [l, a, b];
}

/**
 * HSV → hexadecimal.
 *
 * Delega en la implementación de `colorWorklets.ts` para que el color que pinta
 * el selector en el hilo de UI y el que se dibuja en el logo sean el mismo byte
 * a byte. Con dos conversiones distintas —una aquí y otra en el picker— el
 * pulgar y el logo podían acabar en tonos ligeramente distintos, que es la
 * clase de desajuste de un píxel que delata a una aplicación descuidada.
 *
 * A diferencia de `convert.hsv.rgb`, acepta H, S y V fraccionarios sin
 * redondearlos antes de tiempo.
 */
export function hsvToHex(h: number, s: number, v: number): string {
  return hsvToHexWorklet(h, s, v);
}

export function normalizeHex(hex: string): string {
  const value = hex.replace("#", "").toUpperCase();
  return `#${value}`;
}

export function isWithinTolerance(
  selected: HSVColor,
  target: HSVColor,
  tolerance: HSVColor,
): boolean {
  return (
    hueDistance(selected.h, target.h) <= tolerance.h &&
    Math.abs(selected.s - target.s) <= tolerance.s &&
    Math.abs(selected.v - target.v) <= tolerance.v
  );
}

// A handful of named colors commonly found in raw SVG assets. We only need the
// ones that matter for the dark/light background decision.
const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
};

function expandShortHex(hex: string): string {
  if (hex.length === 4) {
    // #rgb -> #rrggbb
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}

// Relative luminance (WCAG) in the 0..1 range. 0 is black, 1 is white.
export function relativeLuminance(hex: string): number {
  const [r, g, b] = convert.hex
    .rgb(expandShortHex(hex).replace("#", ""))
    .map((channel) => {
      const value = channel / 255;
      return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Formas que pintan algo. Una sin `fill` se dibuja negra: es el valor por
// defecto de SVG, no un descuido del que la exportó.
const SHAPE_REGEX =
  /<(?:path|circle|ellipse|rect|polygon|polyline|text)\b([^>]*)>/gi;

/**
 * ¿Podemos dar por hecho que una forma sin `fill` sale negra?
 *
 * Solo si nadie por encima declara el color: en cuanto un `<svg>` o un `<g>`
 * trae `fill`, las formas de dentro lo heredan y suponer negro sería inventar.
 */
function inheritsDefaultBlack(svgXml: string): boolean {
  return (
    !/<(?:svg|g)\b[^>]*\bfill\s*=/i.test(svgXml) &&
    !/<(?:svg|g)\b[^>]*\bstyle="[^"]*\bfill\s*:/i.test(svgXml)
  );
}

function extractSvgColors(svgXml: string): string[] {
  const colors: string[] = [];

  // El emblema de Bosch es una forma sin `fill`: se pinta negra, pero no hay
  // ni un `#000000` en el archivo. Sin contarla, el logo parecía todo rojo y le
  // tocaba tarjeta oscura, donde el emblema desaparecía.
  if (inheritsDefaultBlack(svgXml)) {
    let shape: RegExpExecArray | null;
    while ((shape = SHAPE_REGEX.exec(svgXml)) !== null) {
      const attrs = shape[1];
      const paints =
        /\bfill\s*=/i.test(attrs) ||
        /\bstyle="[^"]*\bfill\s*:/i.test(attrs) ||
        /\bclass\s*=/i.test(attrs);
      if (!paints) {
        colors.push("#000000");
      }
    }
  }

  // fill / stroke attributes and their inline-style equivalents.
  const attrRegex =
    /(?:fill|stroke)\s*[=:]\s*["']?\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)/g;

  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(svgXml)) !== null) {
    const raw = match[1].toLowerCase();

    if (raw === "none" || raw === "transparent" || raw === "currentcolor") {
      continue;
    }

    if (raw.startsWith("#")) {
      // Ignore 8-digit colors that are fully transparent (alpha === 00).
      if (raw.length === 9 && raw.slice(7) === "00") {
        continue;
      }
      colors.push(expandShortHex(raw.slice(0, 7)));
    } else if (NAMED_COLORS[raw]) {
      colors.push(NAMED_COLORS[raw]);
    }
  }

  return colors;
}

export interface SvgBackgroundTheme {
  background: string;
  border: string;
  isLight: boolean;
}

const DARK_THEME: SvgBackgroundTheme = {
  background: "#111113",
  border: "#27272A",
  isLight: false,
};

const LIGHT_THEME: SvgBackgroundTheme = {
  background: "#FAFAFA",
  border: "#E4E4E7",
  isLight: true,
};

// Decide which card background makes the artwork readable. When the SVG is made
// up mostly of dark colors (or its primary/secondary color is nearly black) the
// default dark card hides it, so we switch to a light background instead.
export function getSvgBackgroundTheme(svgXml: string): SvgBackgroundTheme {
  const colors = extractSvgColors(svgXml);

  if (colors.length === 0) {
    return DARK_THEME;
  }

  const DARK_LUMINANCE = 0.14; // dark colors that blend into the dark card

  const frequency = new Map<string, number>();
  for (const color of colors) {
    frequency.set(color, (frequency.get(color) ?? 0) + 1);
  }

  const ranked = [...frequency.entries()].sort((a, b) => b[1] - a[1]);
  const [primary, secondary] = ranked;

  const primaryIsDark =
    primary != null && relativeLuminance(primary[0]) <= DARK_LUMINANCE;
  const secondaryIsDark =
    secondary != null && relativeLuminance(secondary[0]) <= DARK_LUMINANCE;

  const darkCount = colors.reduce(
    (total, color) =>
      relativeLuminance(color) <= DARK_LUMINANCE ? total + 1 : total,
    0,
  );
  const darkRatio = darkCount / colors.length;

  if (primaryIsDark || secondaryIsDark || darkRatio >= 0.35) {
    return LIGHT_THEME;
  }

  return DARK_THEME;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceColorLiteral(
  svgXml: string,
  original: string,
  replacement: string,
): string {
  const from = normalizeHex(original).toLowerCase();
  const to = normalizeHex(replacement).toLowerCase();
  const regex = new RegExp(`${escapeRegExp(from)}(?![0-9a-fA-F])`, "gi");
  return svgXml.replace(regex, to);
}

// Decide the card background for a challenge based on its "true" logo: the fixed
// parts of the SVG plus the correct answer color for the editable piece. The
// live predicted color is intentionally ignored so the background stays stable
// while the player adjusts the color to guess.
export function getChallengeBackgroundTheme(
  challenge: ChallengeMetadata,
): SvgBackgroundTheme {
  // Si el asset trae la decisión medida, manda ella. La heurística de abajo
  // cuenta literales de color y no sabe cuánta superficie ocupa cada uno, que
  // es lo que de verdad decide si una imagen se ve sobre papel o sobre carbón.
  if (challenge.background) {
    return challenge.background === "light" ? LIGHT_THEME : DARK_THEME;
  }

  if (!challenge.svgXml) {
    return DARK_THEME;
  }

  const editable = challenge.colors?.[challenge.editableColorIndex ?? 0];
  const sourceColors =
    editable?.svgColors ?? (editable?.svgColor ? [editable.svgColor] : []);
  const targetColor = editable?.hex;

  let svgXml = challenge.svgXml;
  if (targetColor) {
    for (const sourceColor of sourceColors) {
      if (sourceColor.toLowerCase() !== targetColor.toLowerCase()) {
        svgXml = replaceColorLiteral(svgXml, sourceColor, targetColor);
      }
    }
  }

  return getSvgBackgroundTheme(svgXml);
}
