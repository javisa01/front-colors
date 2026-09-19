import { Resvg } from "@resvg/resvg-js";
import convert from "color-convert";
import fs from "fs";
import path from "path";

/**
 * Rasteriza cada asset y saca de los píxeles dos cosas que a ojo se calculan
 * mal: **qué color jugable ocupa más área** y **sobre qué fondo se lee mejor**.
 *
 * ## El problema que resuelve
 *
 * `generateMetadata.ts` elige el color principal con `pickPrimaryIndex`, que se
 * queda con el color cromático que pinta **más formas**. Para un logo funciona:
 * el color de marca suele ser el que más veces aparece. Para una bandera es
 * exactamente la señal equivocada.
 *
 * China es el caso de manual: un campo rojo enorme y cinco estrellas amarillas
 * diminutas. Cinco formas amarillas contra una roja → ganaba el amarillo, y el
 * jugador tenía que adivinar el tono de unas estrellas de tres píxeles mientras
 * el 98 % de la imagen era roja. Medido: rojo 28 956 px, amarillo 679.
 *
 * Lo mismo pasaba en Vietnam (una estrella), el Reino Unido (las cruces contra
 * el campo azul) o Estados Unidos (el cantón contra las barras).
 *
 * ## Cómo mide
 *
 * Rasteriza a 200 px de ancho y asigna cada píxel al color jugable más cercano,
 * descartando los que no se parecen a ninguno. Ese descarte es lo que hace que
 * el blanco y el negro no cuenten — el generador ya los excluye de `colors` por
 * ser fondo y contorno, no color de marca — y también se lleva el ruido del
 * antialiasing de los bordes.
 *
 * ## Qué escribe
 *
 * Tres sitios, porque los tres se leen en momentos distintos:
 *
 *  - `assets/sources.json` → `editableColorHex`, para que un `npm run generate`
 *    futuro vuelva a elegir lo mismo en vez de recaer en la heurística.
 *  - `generated/<id>/metadata.json` y `generated/challenges.json` →
 *    `editableColorIndex` ya resuelto. Hace falta porque `npm run generate`
 *    solo procesa los SVG que estén en `assets/logos`, y los ya archivados en
 *    `assets/done` no se volverían a tocar.
 *
 * ## 2. El fondo de la tarjeta
 *
 * `getSvgBackgroundTheme` decide claro u oscuro contando *cuántos literales de
 * color distintos* hay y si alguno es casi negro. Con un logo funciona; con una
 * bandera se equivoca por el mismo motivo que el color: no mira el área.
 *
 * Corea del Sur es el caso claro: campo blanco con trigramas negros. Como hay
 * negro, la tarjeta salía CLARA — y una bandera que es blanca en un 80 % sobre
 * papel blanco no se ve. Aquí se mide qué manda de verdad, el blanco o el
 * negro, y se guarda la decisión ya tomada en el metadata.
 *
 * Uso:
 *   npm run measure:assets                  # todas las banderas
 *   npm run measure:assets -- --dry-run     # solo enseña qué cambiaría
 *   npm run measure:assets -- flag-cn flag-kr
 *   npm run measure:assets -- --category flag
 */

const ASSET_DIR = path.join(process.cwd(), "assets", "done");
const SOURCES_PATH = path.join(process.cwd(), "assets", "sources.json");
const OUTPUT_DIR = path.join(process.cwd(), "generated");
const CHALLENGES_PATH = path.join(OUTPUT_DIR, "challenges.json");

/**
 * Ancho del rasterizado. 200 px bastan de sobra: lo que se compara son
 * proporciones entre áreas, y a este tamaño la estrella más pequeña del
 * catálogo sigue ocupando decenas de píxeles. Subirlo solo cuesta tiempo.
 */
const RASTER_WIDTH = 200;

/**
 * Distancia RGB máxima para dar un píxel por «de este color».
 *
 * 32 es un punto medio deliberado. El generador funde colores a distancia 16,
 * así que por debajo de eso los píxeles limpios ya entran; el margen extra
 * recoge el antialiasing sin llegar a tragarse el blanco del fondo, que es lo
 * que rompería la cuenta en cualquier bandera con franja blanca.
 */
const MATCH_DISTANCE = 32;

/**
 * Ventaja mínima para mover el color elegido, en puntos porcentuales de área.
 *
 * Sin este margen, una bandera de tres franjas iguales —Francia, Italia,
 * Irlanda— cambiaría de color jugable en cada ejecución según qué franja se
 * comiera un píxel más de antialiasing. Con 2 puntos, un empate real se queda
 * como está y solo se mueve lo que de verdad está mal elegido.
 */
const MIN_ADVANTAGE_PCT = 2;

/**
 * Los dos fondos de tarjeta que existen, copiados de `utils/color`. Se comparan
 * aquí para poder decidir cuál esconde menos imagen.
 */
const DARK_CARD = "#111113";
const LIGHT_CARD = "#FAFAFA";

/**
 * Por debajo de esta razón de contraste (WCAG) un píxel se da por perdido: está
 * ahí pero no se distingue del fondo.
 *
 * 1.6 es donde cae la frontera útil. El azul marino de Nueva Zelanda (1.40
 * contra la tarjeta oscura) tiene que contar como perdido; el rojo del círculo
 * japonés (2.86) y el azul griego (3.02) no, porque sobre carbón se ven
 * perfectamente. Clasificar por luminancia a secas, que es lo que hacía la
 * heurística vieja, metía a los tres en el mismo saco de «oscuros» y mandaba
 * Grecia —que es blanca al 42 %— a una tarjeta blanca.
 */
const MIN_CONTRAST = 1.6;

interface AssetSource {
  name: string;
  category?: string;
  editableColorHex?: string;
  [key: string]: unknown;
}

interface Color {
  hex: string;
  hsv: { h: number; s: number; v: number };
  svgColor?: string;
  svgColors?: string[];
}

type Background = "dark" | "light";

interface Metadata {
  id: string;
  editableColorIndex?: number;
  background?: Background;
  colors: Color[];
  [key: string]: unknown;
}

interface Options {
  ids: string[] | null;
  category: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Options {
  const ids: string[] = [];
  let category = "flag";
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--category") {
      category = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Opción desconocida: ${arg}`);
    }
    ids.push(arg);
  }

  return { ids: ids.length > 0 ? ids : null, category, dryRun };
}

function toRgb(hex: string): [number, number, number] {
  return convert.hex.rgb(hex.replace("#", "")) as [number, number, number];
}

function distance(a: [number, number, number], r: number, g: number, b: number): number {
  return Math.sqrt((a[0] - r) ** 2 + (a[1] - g) ** 2 + (a[2] - b) ** 2);
}

/** Luminancia relativa (WCAG) de un píxel, de 0 a 1. */
function luminance(r: number, g: number, b: number): number {
  const channel = (value: number): number => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: number, b: number): number {
  return a > b ? (a + 0.05) / (b + 0.05) : (b + 0.05) / (a + 0.05);
}

const DARK_CARD_LUMINANCE = luminance(...toRgb(DARK_CARD));
const LIGHT_CARD_LUMINANCE = luminance(...toRgb(LIGHT_CARD));

interface Measurement {
  /** Píxeles de cada color jugable, en el mismo orden que `colors`. */
  counts: number[];
  /** Proporción de imagen que se pierde contra cada fondo. */
  lostOnDark: number;
  lostOnLight: number;
}

function measure(svgXml: string, colors: Color[]): Measurement {
  const png = new Resvg(svgXml, {
    fitTo: { mode: "width", value: RASTER_WIDTH },
  }).render();

  const targets = colors.map((color) => toRgb(color.hex));
  const counts = new Array<number>(colors.length).fill(0);
  const pixels = png.pixels;

  let opaque = 0;
  let lostOnDark = 0;
  let lostOnLight = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    // Lo transparente no es área de nadie: sin esto, una bandera con recortes
    // sumaría su fondo al color más cercano al negro.
    if (pixels[i + 3] < 128) {
      continue;
    }

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    opaque += 1;

    const pixelLuminance = luminance(r, g, b);
    if (contrast(pixelLuminance, DARK_CARD_LUMINANCE) < MIN_CONTRAST) {
      lostOnDark += 1;
    }
    if (contrast(pixelLuminance, LIGHT_CARD_LUMINANCE) < MIN_CONTRAST) {
      lostOnLight += 1;
    }

    let best = -1;
    let bestDistance = MATCH_DISTANCE;
    for (let c = 0; c < targets.length; c += 1) {
      const d = distance(targets[c], r, g, b);
      if (d < bestDistance) {
        bestDistance = d;
        best = c;
      }
    }
    if (best >= 0) {
      counts[best] += 1;
    }
  }

  return {
    counts,
    lostOnDark: opaque > 0 ? lostOnDark / opaque : 0,
    lostOnLight: opaque > 0 ? lostOnLight / opaque : 0,
  };
}

/**
 * Sobre qué fondo se lee mejor la imagen: el que **esconde menos superficie**.
 *
 * No hay categorías ni umbrales por color, solo la cuenta de cuánta imagen
 * desaparece contra cada uno de los dos fondos. Un empate se queda en oscuro,
 * que es el fondo por defecto de la aplicación.
 */
function pickBackground(lostOnDark: number, lostOnLight: number): Background {
  return lostOnLight < lostOnDark ? "light" : "dark";
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

const { ids, category, dryRun } = parseArgs(process.argv.slice(2));

const sources = readJson<Record<string, AssetSource>>(SOURCES_PATH);
const challenges = readJson<Metadata[]>(CHALLENGES_PATH);
const challengeById = new Map(challenges.map((entry) => [entry.id, entry]));

const targets = (
  ids ?? Object.keys(sources).filter((id) => sources[id].category === category)
).sort();

if (targets.length === 0) {
  console.log(`No hay assets que medir (categoría: ${category}).`);
  process.exit(0);
}

interface ColorChange {
  id: string;
  from: string;
  to: string;
  fromPct: number;
  toPct: number;
}

interface BackgroundChange {
  id: string;
  to: Background;
  lostOnDarkPct: number;
  lostOnLightPct: number;
}

const changes: ColorChange[] = [];
const backgroundChanges: BackgroundChange[] = [];
const kept: string[] = [];
const skipped: string[] = [];
const touched = new Set<string>();

for (const id of targets) {
  const metadataPath = path.join(OUTPUT_DIR, id, "metadata.json");
  const svgPath = path.join(ASSET_DIR, `${id}.svg`);

  if (!fs.existsSync(metadataPath) || !fs.existsSync(svgPath)) {
    skipped.push(`${id} (falta el SVG o el metadata)`);
    continue;
  }

  const metadata = readJson<Metadata>(metadataPath);
  const { counts, lostOnDark, lostOnLight } = measure(
    fs.readFileSync(svgPath, "utf8"),
    metadata.colors,
  );

  // El fondo se decide siempre, incluso para un asset de un solo color: no
  // depende de cuántos colores jugables tenga, sino de cuánto blanco y cuánto
  // negro hay en la imagen.
  const background = pickBackground(lostOnDark, lostOnLight);
  if (metadata.background !== background) {
    backgroundChanges.push({
      id,
      to: background,
      lostOnDarkPct: lostOnDark * 100,
      lostOnLightPct: lostOnLight * 100,
    });
    metadata.background = background;
    const target = challengeById.get(id);
    if (target) {
      target.background = background;
    }
    touched.add(id);
  }

  const total = counts.reduce((a, b) => a + b, 0);
  if (metadata.colors.length < 2 || total === 0) {
    // Un solo color jugable (o ninguno reconocible): no hay color que elegir,
    // pero el fondo ya está decidido y hay que guardarlo igualmente.
    if (!dryRun && touched.has(id)) {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    }
    kept.push(id);
    continue;
  }

  const current = metadata.editableColorIndex ?? 0;
  let winner = 0;
  for (let i = 1; i < counts.length; i += 1) {
    if (counts[i] > counts[winner]) {
      winner = i;
    }
  }

  const currentPct = (counts[current] / total) * 100;
  const winnerPct = (counts[winner] / total) * 100;

  if (winner !== current && winnerPct - currentPct >= MIN_ADVANTAGE_PCT) {
    changes.push({
      id,
      from: metadata.colors[current].hex,
      to: metadata.colors[winner].hex,
      fromPct: currentPct,
      toPct: winnerPct,
    });

    metadata.editableColorIndex = winner;
    const challenge = challengeById.get(id);
    if (challenge) {
      challenge.editableColorIndex = winner;
    }
    sources[id] = {
      ...sources[id],
      editableColorHex: metadata.colors[winner].hex,
    };
    touched.add(id);
  } else {
    kept.push(id);
  }

  if (!dryRun && touched.has(id)) {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  }
}

if (!dryRun && touched.size > 0) {
  fs.writeFileSync(CHALLENGES_PATH, `${JSON.stringify(challenges, null, 2)}`);
  fs.writeFileSync(SOURCES_PATH, `${JSON.stringify(sources, null, 2)}\n`);
}

// ---- Informe --------------------------------------------------------------

console.log(
  `\nMedidos ${targets.length} assets${dryRun ? " (simulación, no se ha escrito nada)" : ""}.\n`,
);

if (changes.length > 0) {
  console.log("Color jugable cambiado:");
  for (const change of changes) {
    console.log(
      `  • ${change.id.padEnd(12)} ${change.from} (${change.fromPct.toFixed(1)}%)` +
        ` → ${change.to} (${change.toPct.toFixed(1)}%)`,
    );
  }
  console.log();
}

if (backgroundChanges.length > 0) {
  const toDark = backgroundChanges.filter((change) => change.to === "dark");
  const toLight = backgroundChanges.filter((change) => change.to === "light");
  console.log(
    `Fondo de tarjeta: ${toDark.length} a oscuro, ${toLight.length} a claro.`,
  );
  for (const change of toDark.slice(0, 10)) {
    console.log(
      `  • ${change.id.padEnd(12)} oscuro ` +
        `(se perdería ${change.lostOnLightPct.toFixed(0)} % sobre claro, ` +
        `${change.lostOnDarkPct.toFixed(0)} % sobre oscuro)`,
    );
  }
  if (toDark.length > 10) {
    console.log(`  … y ${toDark.length - 10} más a oscuro.`);
  }
  console.log();
}

if (skipped.length > 0) {
  console.log("Sin medir:");
  for (const line of skipped) {
    console.log(`  - ${line}`);
  }
  console.log();
}

console.log(
  `Color: ${changes.length} cambiado(s), ${kept.length} ya estaban bien.` +
    ` Fondo: ${backgroundChanges.length} cambiado(s).` +
    ` ${skipped.length} sin medir.`,
);
