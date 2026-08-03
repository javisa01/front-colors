import convert from "color-convert";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import path from "path";

/**
 * Turns every `.svg` in `assets/logos` into a challenge `metadata.json` plus the
 * aggregate `challenges.json` / `manifest.json` used by the app.
 *
 * The tricky part is color detection: real-world logo SVGs (exported from
 * Illustrator, Inkscape, SVG Repo, Figma...) paint their shapes in wildly
 * different ways. This generator resolves each shape's *effective* paint the way
 * a browser would, following CSS precedence:
 *
 *   inline `style="fill:..."`  >  presentation attribute `fill="..."`  >  class
 *
 * and understands hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), `rgb()/rgba()`
 * and named colors, whether they live in attributes, inline styles or a
 * `<style>` block with CSS classes. Near-identical colors are merged so a stray
 * `#020202` outline doesn't split from a `#000000` fill, and a sensible primary
 * (`editableColorIndex`) is chosen automatically.
 */

interface OutputColor {
  hex: string;
  hsv: { h: number; s: number; v: number };
  // Original literal as written in the SVG, kept only when it differs from
  // `hex` so the in-app color swap can find and replace it verbatim.
  svgColor?: string;
}

interface CollectedColor {
  hex: string; // #RRGGBB uppercase — canonical value used for scoring.
  literal: string; // exact literal as found in the SVG (for replacement).
  rgb: [number, number, number];
  count: number; // how many shapes use it (rough prominence heuristic).
}

const LOGO_DIR = path.join(process.cwd(), "assets", "logos");
const OUTPUT_DIR = path.join(process.cwd(), "generated");

// Two colors closer than this (Euclidean distance in RGB) are treated as the
// same paint. Keeps outlines/placeholders from inflating the color count while
// staying far below the gap between distinct brand colors.
const DUPLICATE_RGB_DISTANCE = 16;

// Near-black and near-white colors are almost always backgrounds/outlines, not
// brand colors. Excluding them prevents logos like Snapchat (yellow + black +
// white) from being tagged as multicolor when only the yellow matters.
const BLACK_V_THRESHOLD = 12; // HSV value ≤ 12 → near-black
const WHITE_SV_THRESHOLD_S = 10; // HSV saturation ≤ 10 AND value > 90 → near-white

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

// A pragmatic subset of CSS named colors — the ones that actually show up in
// logo assets. Anything not listed is reported so it can be handled by hand.
const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  lime: "#00ff00",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  cyan: "#00ffff",
  aqua: "#00ffff",
  magenta: "#ff00ff",
  fuchsia: "#ff00ff",
  silver: "#c0c0c0",
  gray: "#808080",
  grey: "#808080",
  maroon: "#800000",
  olive: "#808000",
  purple: "#800080",
  teal: "#008080",
  navy: "#000080",
  orange: "#ffa500",
  gold: "#ffd700",
  pink: "#ffc0cb",
  brown: "#a52a2a",
  crimson: "#dc143c",
  indigo: "#4b0082",
  violet: "#ee82ee",
  turquoise: "#40e0d0",
  coral: "#ff7f50",
  salmon: "#fa8072",
  khaki: "#f0e68c",
  beige: "#f5f5dc",
  ivory: "#fffff0",
  lightgray: "#d3d3d3",
  lightgrey: "#d3d3d3",
  darkgray: "#a9a9a9",
  darkgrey: "#a9a9a9",
  royalblue: "#4169e1",
  dodgerblue: "#1e90ff",
  steelblue: "#4682b4",
  skyblue: "#87ceeb",
  tomato: "#ff6347",
  chocolate: "#d2691e",
};

function expandShortHex(hex: string): string | null {
  const clean = hex.toLowerCase();
  if (clean.length === 3) {
    return clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (clean.length === 4) {
    // #rgba — drop the alpha nibble, expand the rest.
    if (clean[3] === "0") {
      return null; // fully transparent
    }
    return clean
      .slice(0, 3)
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (clean.length === 6) {
    return clean;
  }
  if (clean.length === 8) {
    if (clean.slice(6) === "00") {
      return null; // fully transparent
    }
    return clean.slice(0, 6);
  }
  return null;
}

/**
 * Parses any single color literal into a canonical 6-digit hex plus the literal
 * itself. Returns null for keywords that don't represent a solid paint (`none`,
 * `transparent`, `currentColor`, gradients/patterns via `url(...)`, unknown
 * names) so callers can simply skip them.
 */
function parseColorLiteral(
  raw: string,
): { hex: string; literal: string } | null {
  const literal = raw.trim();
  const value = literal.toLowerCase();

  if (
    !value ||
    value === "none" ||
    value === "transparent" ||
    value === "currentcolor" ||
    value === "inherit" ||
    value.startsWith("url(")
  ) {
    return null;
  }

  const hexMatch = value.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    const expanded = expandShortHex(hexMatch[1]);
    return expanded ? { hex: `#${expanded.toUpperCase()}`, literal } : null;
  }

  const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[,\s/]+/).filter(Boolean);
    if (parts.length < 3) {
      return null;
    }
    if (parts.length >= 4 && parseFloat(parts[3]) === 0) {
      return null; // fully transparent
    }
    const rgb = parts
      .slice(0, 3)
      .map((part) =>
        part.endsWith("%")
          ? Math.round((parseFloat(part) / 100) * 255)
          : Math.round(parseFloat(part)),
      );
    if (rgb.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return null;
    }
    return {
      hex: `#${convert.rgb.hex(rgb as [number, number, number])}`,
      literal,
    };
  }

  if (value in NAMED_COLORS) {
    return { hex: NAMED_COLORS[value].toUpperCase(), literal };
  }

  return null;
}

/**
 * Builds a `className -> { fill, stroke }` map from every `<style>` block. Later
 * rules override earlier ones, matching CSS cascade order.
 */
function parseStyleClasses(
  xml: string,
): Record<string, { fill?: string; stroke?: string }> {
  const classes: Record<string, { fill?: string; stroke?: string }> = {};
  const styleBlocks = xml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  if (!styleBlocks) {
    return classes;
  }

  for (const block of styleBlocks) {
    const css = block
      .replace(/<style[^>]*>/i, "")
      .replace(/<\/style>/i, "")
      .replace(/\/\*[\s\S]*?\*\//g, ""); // strip comments

    const ruleRegex = /([^{}]+)\{([^}]*)\}/g;
    let rule: RegExpExecArray | null;
    while ((rule = ruleRegex.exec(css)) !== null) {
      const selectors = rule[1].split(",").map((s) => s.trim());
      const body = rule[2];
      const fill = body.match(/(?:^|[;\s])fill\s*:\s*([^;]+)/i)?.[1]?.trim();
      const stroke = body
        .match(/(?:^|[;\s])stroke\s*:\s*([^;]+)/i)?.[1]
        ?.trim();

      if (!fill && !stroke) {
        continue;
      }

      for (const selector of selectors) {
        const cls = selector.match(/\.([a-zA-Z0-9_-]+)/)?.[1];
        if (!cls) {
          continue;
        }
        classes[cls] ??= {};
        if (fill) {
          classes[cls].fill = fill;
        }
        if (stroke) {
          classes[cls].stroke = stroke;
        }
      }
    }
  }

  return classes;
}

function styleProp(
  style: string | undefined,
  prop: "fill" | "stroke",
): string | undefined {
  if (!style) {
    return undefined;
  }
  const match = style.match(
    new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`, "i"),
  );
  return match?.[1]?.trim();
}

function classProp(
  classAttr: string | undefined,
  classes: Record<string, { fill?: string; stroke?: string }>,
  prop: "fill" | "stroke",
): string | undefined {
  if (!classAttr) {
    return undefined;
  }
  let resolved: string | undefined;
  for (const token of classAttr.split(/\s+/).filter(Boolean)) {
    const value = classes[token]?.[prop];
    if (value) {
      resolved = value; // last matching class wins
    }
  }
  return resolved;
}

function rgbDistance(a: [number, number, number], b: number[]): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
  );
}

function addColor(
  collected: Map<string, CollectedColor>,
  parsed: { hex: string; literal: string },
): void {
  const rgb = convert.hex.rgb(parsed.hex.replace("#", "")) as [
    number,
    number,
    number,
  ];

  for (const existing of collected.values()) {
    if (rgbDistance(existing.rgb, rgb) <= DUPLICATE_RGB_DISTANCE) {
      existing.count += 1;
      return;
    }
  }

  collected.set(parsed.hex, {
    hex: parsed.hex,
    literal: parsed.literal,
    rgb,
    count: 1,
  });
}

function visit(
  node: unknown,
  classes: Record<string, { fill?: string; stroke?: string }>,
  collected: Map<string, CollectedColor>,
): void {
  if (Array.isArray(node)) {
    node.forEach((child) => visit(child, classes, collected));
    return;
  }
  if (!node || typeof node !== "object") {
    return;
  }

  const current = node as Record<string, unknown>;
  const style = typeof current.style === "string" ? current.style : undefined;
  const classAttr =
    typeof current.class === "string" ? current.class : undefined;
  const fillAttr = typeof current.fill === "string" ? current.fill : undefined;
  const strokeAttr =
    typeof current.stroke === "string" ? current.stroke : undefined;

  // Resolve the effective paint following CSS precedence.
  const effectiveFill =
    styleProp(style, "fill") ??
    fillAttr ??
    classProp(classAttr, classes, "fill");
  const effectiveStroke =
    styleProp(style, "stroke") ??
    strokeAttr ??
    classProp(classAttr, classes, "stroke");

  for (const raw of [effectiveFill, effectiveStroke]) {
    if (!raw) {
      continue;
    }
    const parsed = parseColorLiteral(raw);
    if (parsed) {
      addColor(collected, parsed);
    }
  }

  for (const value of Object.values(current)) {
    visit(value, classes, collected);
  }
}

/**
 * Picks the most representative color to be the default editable one: the most
 * used chromatic color, ignoring near-white and near-black which are usually
 * backgrounds or outlines. Falls back to the most used color for monochrome
 * (all white/black) logos.
 */
function pickPrimaryIndex(colors: CollectedColor[]): number {
  if (colors.length <= 1) {
    return 0;
  }

  const entries = colors.map((color, index) => ({
    index,
    count: color.count,
    hsv: convert.rgb.hsv(color.rgb),
  }));

  const chromatic = entries.filter(
    ({ hsv }) => hsv[2] >= 12 && !(hsv[2] > 90 && hsv[1] < 10),
  );
  const pool = chromatic.length > 0 ? chromatic : entries;

  pool.sort((a, b) => b.count - a.count || b.hsv[1] - a.hsv[1]);
  return pool[0].index;
}

function toOutputColor(color: CollectedColor): OutputColor {
  const [h, s, v] = convert.hex.hsv(color.hex.replace("#", ""));
  const output: OutputColor = { hex: color.hex, hsv: { h, s, v } };

  // Keep the raw literal only when the app couldn't re-derive it from `hex`
  // (short hex, rgb(), named color, ...), so the in-SVG replacement still works.
  if (color.literal.replace(/\s+/g, "").toUpperCase() !== color.hex) {
    output.svgColor = color.literal;
  }
  return output;
}

interface ProcessResult {
  id: string;
  colors: number;
  primaryHex: string | null;
}

function processSVG(file: string): ProcessResult {
  const fullPath = path.join(LOGO_DIR, file);
  const xml = fs.readFileSync(fullPath, "utf8");

  const classes = parseStyleClasses(xml);
  const parsed = parser.parse(xml);

  const collected = new Map<string, CollectedColor>();
  visit(parsed, classes, collected);

  // Drop near-black and near-white colors — they're backgrounds/outlines, not
  // meaningful brand colors, and would inflate the count for multicolor mode.
  const colorList = [...collected.values()].filter((color) => {
    const [, s, v] = convert.rgb.hsv(color.rgb);
    if (v <= BLACK_V_THRESHOLD) return false;
    if (s <= WHITE_SV_THRESHOLD_S && v > 90) return false;
    return true;
  });
  const editableColorIndex = pickPrimaryIndex(colorList);
  const colors: OutputColor[] = colorList.map(toOutputColor);

  const name = path.basename(file, ".svg");
  const outputFolder = path.join(OUTPUT_DIR, name);
  fs.mkdirSync(outputFolder, { recursive: true });

  fs.writeFileSync(
    path.join(outputFolder, "metadata.json"),
    JSON.stringify(
      {
        id: name,
        svg: file,
        svgXml: xml,
        editableColorIndex,
        colors,
      },
      null,
      2,
    ),
  );

  return {
    id: name,
    colors: colors.length,
    primaryHex: colors[editableColorIndex]?.hex ?? null,
  };
}

const CHALLENGES_PATH = path.join(OUTPUT_DIR, "challenges.json");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");

const files = fs
  .readdirSync(LOGO_DIR)
  .filter((f: string) => f.endsWith(".svg"));

// Only (re)generate metadata for the SVGs currently in assets/logos.
const manifest = files.map(processSVG);

interface CatalogEntry {
  id: string;
  colors: unknown[];
  [key: string]: unknown;
}

// The generator is ADDITIVE: it never rewrites the whole catalog from scratch.
// Existing entries (which may include manual edits) are kept verbatim, and only
// the logos we just processed are added or refreshed. This means running with
// just a handful of SVGs present can never drop or blank the other logos.
const existingCatalog: CatalogEntry[] = fs.existsSync(CHALLENGES_PATH)
  ? JSON.parse(fs.readFileSync(CHALLENGES_PATH, "utf8"))
  : [];

const catalogById = new Map<string, CatalogEntry>(
  existingCatalog.map((entry) => [entry.id, entry]),
);

// Refresh / insert only the logos that were regenerated this run.
for (const { id } of manifest) {
  const metadataPath = path.join(OUTPUT_DIR, id, "metadata.json");
  const entry: CatalogEntry = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  catalogById.set(id, entry);
}

const challengeCatalog = [...catalogById.values()].sort((a, b) =>
  a.id.localeCompare(b.id),
);

fs.writeFileSync(CHALLENGES_PATH, JSON.stringify(challengeCatalog, null, 2));

fs.writeFileSync(
  MANIFEST_PATH,
  JSON.stringify(
    challengeCatalog.map((c) => ({ id: c.id, colors: c.colors.length })),
    null,
    2,
  ),
);

// ---- Report -------------------------------------------------------------
const empty = manifest.filter((m) => m.colors === 0);
const multicolor = manifest.filter((m) => m.colors >= 3);

console.log(`\nProcesados ${manifest.length} SVG.\n`);
for (const item of manifest) {
  const tag =
    item.colors === 0
      ? "⚠️  SIN COLORES — revisar a mano"
      : item.colors >= 3
        ? `multicolor (primario ${item.primaryHex})`
        : `${item.colors} color(es) (primario ${item.primaryHex})`;
  console.log(
    `  • ${item.id.padEnd(16)} ${String(item.colors).padStart(2)} → ${tag}`,
  );
}

console.log(
  `\nResumen: ${multicolor.length} apto(s) para multicolor, ${empty.length} sin color.`,
);

if (empty.length > 0) {
  console.log(
    "\nSVG sin colores detectados (probablemente usan solo degradados/imágenes\n" +
      "embebidas, o un formato de color no soportado). Revísalos manualmente:",
  );
  for (const item of empty) {
    console.log(`  - ${item.id}.svg`);
  }
}
