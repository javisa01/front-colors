import { normalizeHex } from "@/utils/color";

/**
 * Preparación del SVG antes de pintarlo y sustitución del color editable.
 *
 * Vive fuera del componente para que las herramientas (`tools/checkLogos.ts`)
 * validen exactamente el mismo pipeline que ve el jugador: si aquí se rompe un
 * logo, el checker lo detecta sin arrancar la app.
 */

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureViewBox(svgXml: string): string {
  if (/\bviewBox\s*=/i.test(svgXml)) {
    return svgXml;
  }

  const width = svgXml.match(/<svg[^>]*?\bwidth="([\d.]+)/i)?.[1];
  const height = svgXml.match(/<svg[^>]*?\bheight="([\d.]+)/i)?.[1];

  if (!width || !height) {
    return svgXml;
  }

  return svgXml.replace(/<svg\b/i, `<svg viewBox="0 0 ${width} ${height}"`);
}

interface ClassPaint {
  fill?: string;
  stroke?: string;
}

/**
 * Lee TODOS los bloques `<style>` y devuelve `clase -> { fill, stroke }`.
 *
 * Tres detalles que un `match` simple se dejaba por el camino y rompían logos:
 * hay SVG con más de un bloque `<style>`, los selectores vienen en listas
 * (`.cls-2, .cls-5 { fill: none }`) y una regla posterior sobre la misma clase
 * solo debe pisar la propiedad que declara, no el resto.
 */
function parseStyleClasses(svgXml: string): Record<string, ClassPaint> {
  const classStyles: Record<string, ClassPaint> = {};
  const styleBlocks = svgXml.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
  if (!styleBlocks) {
    return classStyles;
  }

  for (const block of styleBlocks) {
    const cssText = block
      .replace(/<style[^>]*>/i, "")
      .replace(/<\/style>/i, "")
      .replace(/<!\[CDATA\[/g, "")
      .replace(/\]\]>/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    const ruleRegex = /([^{}]+)\{([^}]*)\}/g;
    let ruleMatch: RegExpExecArray | null;
    while ((ruleMatch = ruleRegex.exec(cssText)) !== null) {
      const body = ruleMatch[2];
      const fill = body.match(/(?:^|[;\s])fill\s*:\s*([^;}]+)/i)?.[1]?.trim();
      const stroke = body
        .match(/(?:^|[;\s])stroke\s*:\s*([^;}]+)/i)?.[1]
        ?.trim();
      if (!fill && !stroke) {
        continue;
      }

      for (const selector of ruleMatch[1].split(",")) {
        const className = selector.trim().match(/\.([a-zA-Z_][\w-]*)$/)?.[1];
        if (!className) {
          continue;
        }
        classStyles[className] ??= {};
        if (fill) {
          classStyles[className].fill = fill;
        }
        if (stroke) {
          classStyles[className].stroke = stroke;
        }
      }
    }
  }

  return classStyles;
}

// Expand CSS class-based fill/stroke rules to inline attributes so that
// react-native-svg applies them reliably and color replacement works.
function inlineCssColors(svgXml: string): string {
  const classStyles = parseStyleClasses(svgXml);

  let result = svgXml;
  for (const [className, props] of Object.entries(classStyles)) {
    const elRegex = new RegExp(
      `(<[a-zA-Z][^>]*\\bclass="[^"]*\\b${escapeRegExp(className)}\\b[^"]*"[^>]*?)(\\s*/?>)`,
      "gi",
    );
    result = result.replace(elRegex, (_full, before, close) => {
      let attrs = "";
      if (
        props.fill &&
        !/\bfill\s*=/i.test(before) &&
        !/\bstyle="[^"]*fill\s*:/i.test(before)
      ) {
        attrs += ` fill="${props.fill}"`;
      }
      if (
        props.stroke &&
        !/\bstroke\s*=/i.test(before) &&
        !/\bstyle="[^"]*stroke\s*:/i.test(before)
      ) {
        attrs += ` stroke="${props.stroke}"`;
      }
      return `${before}${attrs}${close}`;
    });
  }

  // Remove the now-redundant <style> blocks; react-native-svg does not apply
  // CSS classes and leaving raw CSS in the tree can break its parser.
  result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  return result;
}

/**
 * Copia al atributo `fill`/`stroke` el valor que ya vivía en el `style` del
 * mismo elemento.
 *
 * En SVG el `style` gana al atributo de presentación, pero `react-native-svg`
 * hace lo contrario: al montar el nodo mezcla `{ ...style, ...props }`, así que
 * en `fill="#064a93" style="fill:#00095b"` pinta el PRIMERO. Inkscape genera
 * justo ese conflicto —deja el atributo original y escribe el color nuevo en el
 * `style`— y era la razón de que el azul de Ford no cambiara: la sustitución
 * tocaba el literal del `style`, que es el que el renderer ignoraba.
 *
 * Igualando los dos deja de importar cuál gane. Si el elemento solo trae el
 * `style`, no hay nada que igualar: sin atributo que lo pise, ya se aplica.
 */
function applyStylePaintPrecedence(svgXml: string): string {
  return svgXml.replace(/<[a-zA-Z][^>]*>/g, (tag) => {
    const style = tag.match(/\sstyle="([^"]*)"/i)?.[1];
    if (!style) {
      return tag;
    }

    let result = tag;
    for (const property of ["fill", "stroke"] as const) {
      const value = style
        .match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"))?.[1]
        ?.trim();
      if (!value) {
        continue;
      }
      result = result.replace(
        new RegExp(`(\\s${property}=)"[^"]*"`, "i"),
        `$1"${value}"`,
      );
    }
    return result;
  });
}

// Namespaces that only carry editor bookkeeping: Inkscape/Sodipodi document
// settings and the RDF licensing block. Nothing here draws anything.
//
// `svg` is deliberately absent: a file that declares `xmlns:svg` may also write
// its real shapes as <svg:path>, and dropping those would erase the logo. Its
// declaration is handled apart, only when no element actually uses the prefix.
const EDITOR_NAMESPACES = "sodipodi|inkscape|dc|cc|rdf";

/**
 * Strip the editor metadata Inkscape leaves behind.
 *
 * `SvgXml` hands every attribute it does not know down to the underlying
 * element, camelCasing the name on the way. On web that element is a DOM node,
 * so `inkscape:label` arrives as `inkscapeLabel` and React logs one "React does
 * not recognize the X prop on a DOM element" warning per attribute per logo —
 * dozens of them on a single screen. They are noise rather than a broken render,
 * but the fix is to stop shipping attributes that no renderer reads.
 */
function stripEditorMetadata(svgXml: string): string {
  let result = svgXml
    // <sodipodi:namedview .../>, <inkscape:grid .../>
    .replace(new RegExp(`<(?:${EDITOR_NAMESPACES}):[\\w-]+[^>]*?/>`, "gi"), "")
    // <rdf:RDF>...</rdf:RDF> and any other paired namespaced element.
    .replace(
      new RegExp(
        `<(${EDITOR_NAMESPACES}):([\\w-]+)[^>]*>[\\s\\S]*?</\\1:\\2>`,
        "gi",
      ),
      "",
    )
    .replace(/<metadata\b[^>]*>[\s\S]*?<\/metadata>/gi, "")
    // The xmlns:* declarations, and then the attributes that used them.
    .replace(new RegExp(`\\s+xmlns:(?:${EDITOR_NAMESPACES})="[^"]*"`, "gi"), "")
    .replace(
      new RegExp(`\\s+(?:${EDITOR_NAMESPACES}):[\\w-]+="[^"]*"`, "gi"),
      "",
    );

  if (!/<svg:/i.test(result)) {
    result = result.replace(/\s+xmlns:svg="[^"]*"/gi, "");
  }

  return result;
}

export function sanitizeSvgXml(svgXml: string): string {
  const cleaned = stripEditorMetadata(svgXml)
    .replace(/^<\?xml[^>]*\?>/i, "")
    // Remove full DOCTYPE declarations, including internal subsets ([...]).
    .replace(/<!DOCTYPE[\s\S]*?(?:\]>|>)/gi, "")
    .replace(/<!ENTITY[^>]*>/gi, "")
    .replace(/^\s*\]>\s*/gm, "")
    .replace(/\bxlink:href\b/gi, "href")
    .replace(/\s+xmlns:xlink="[^"]*"/gi, "")
    // Drop authored alignment (e.g. "xMinYMin meet") so every logo falls back to
    // the default xMidYMid meet and stays centered inside the square card.
    .replace(/\s+preserveAspectRatio="[^"]*"/gi, "")
    .trim();

  return ensureViewBox(applyStylePaintPrecedence(inlineCssColors(cleaned)));
}

function colorPattern(source: string): string {
  // The source color may be a hex literal (`#0060a8`), an `rgb()` string
  // (`rgb(0, 96, 168)`) or a CSS named color (`red`). Each needs a different
  // match: rgb() must be matched verbatim (flexible whitespace), hex avoids
  // matching a longer 8-digit value, and named colors are matched as whole
  // words so `red` does not swallow part of another token.
  const isRgb = /^rgba?\(/i.test(source);
  const isHex = /^#?[0-9a-fA-F]{3,8}$/.test(source);

  if (isRgb) {
    return escapeRegExp(source).replace(/\\?\s+/g, "\\s*");
  }
  if (isHex) {
    return `${escapeRegExp(normalizeHex(source).toLowerCase())}(?![0-9a-fA-F])`;
  }
  return `\\b${escapeRegExp(source.toLowerCase())}\\b`;
}

/**
 * Cambia por `replacementColor` todos los literales con los que el SVG pinta el
 * color editable.
 *
 * Son varios a propósito: el generador fusiona tonos casi idénticos en un mismo
 * color jugable (un `#020202` junto a un `#000000`), así que sustituir solo el
 * primero dejaba trozos del logo sin repintar.
 */
export function replaceColorInSvg(
  svgXml: string,
  originalColors: readonly string[] | string,
  replacementColor: string,
): string {
  const normalizedReplacement = normalizeHex(replacementColor).toLowerCase();
  const sources = (
    typeof originalColors === "string" ? [originalColors] : [...originalColors]
  )
    .map((color) => color.trim())
    .filter(Boolean);

  let result = sanitizeSvgXml(svgXml);
  for (const source of sources) {
    result = result.replace(
      new RegExp(colorPattern(source), "gi"),
      normalizedReplacement,
    );
  }

  return result;
}
