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

const GRADIENT_REGEX =
  /<(linearGradient|radialGradient)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;

function readAttr(attrs: string, name: string): string | undefined {
  return attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

/**
 * Copia dentro del gradiente las `<stop>` del gradiente al que apunta con `href`.
 *
 * En SVG un gradiente puede heredar sus paradas de otro
 * (`<linearGradient href="#otro" x1="…"/>`), y es lo que escribe Inkscape al
 * reutilizar un degradado. Pero `extractGradient` de react-native-svg construye
 * las paradas SOLO con los hijos del propio elemento —`href` no aparece ni en
 * `LinearGradient`, ni en `RadialGradient`, ni en el extractor—, así que el
 * gradiente se queda con cero paradas y la forma no se pinta. Eso es lo que se
 * comía la solapa de color de Outlook, Word, PowerPoint y Access, y lo que
 * dejaba en negro las figuras del escudo de varias banderas.
 *
 * Se copian solo las paradas: la geometría (`x1`, `cx`, `gradientTransform`…)
 * la traen ya todos los gradientes del catálogo en su propio elemento.
 */
function inlineGradientStops(svgXml: string): string {
  const porId = new Map<string, { stops: string; href?: string }>();
  for (const [, , attrs, inner = ""] of svgXml.matchAll(GRADIENT_REGEX)) {
    const id = readAttr(attrs, "id");
    if (!id) {
      continue;
    }
    porId.set(id, {
      stops: /<stop\b/.test(inner) ? inner : "",
      href: readAttr(attrs, "href")?.replace(/^#/, ""),
    });
  }

  // Un gradiente puede apuntar a otro que a su vez hereda. `vistos` corta el
  // ciclo de un SVG mal hecho en vez de desbordar la pila.
  const stopsDe = (id: string, vistos = new Set<string>()): string => {
    if (vistos.has(id)) {
      return "";
    }
    vistos.add(id);
    const entrada = porId.get(id);
    if (!entrada) {
      return "";
    }
    return entrada.stops || (entrada.href ? stopsDe(entrada.href, vistos) : "");
  };

  return svgXml.replace(
    GRADIENT_REGEX,
    (completo, tag: string, attrs: string, inner?: string) => {
      const href = readAttr(attrs, "href");
      if (!href?.startsWith("#") || /<stop\b/.test(inner ?? "")) {
        return completo;
      }
      const stops = stopsDe(href.slice(1));
      if (!stops) {
        return completo;
      }
      const sinHref = attrs.replace(/\s*\bhref="[^"]*"/, "");
      return `<${tag}${sinHref}>${stops}</${tag}>`;
    },
  );
}

/**
 * Convierte `<use href="#s"/>` + `<symbol id="s">` en un `<g>` con el contenido
 * dentro.
 *
 * `react-native-svg` monta `<symbol>` sobre un componente nativo que se coloca a
 * partir del `viewBox`, así que un símbolo sin él —como el de SoundCloud, que
 * mete el logo entero dentro— no pinta nada y el reto sale en blanco.
 *
 * Un `<use>` que apunte a cualquier otra cosa se deja como está: funciona, y lo
 * usan sesenta y tantos logos del catálogo. Los símbolos CON `viewBox` también
 * se dejan, porque ahí el `<use>` además escala y eso no se arregla envolviendo
 * el contenido en un grupo.
 */
function flattenSymbols(svgXml: string): string {
  const simbolos = new Map<string, string>();
  for (const [, attrs, inner] of svgXml.matchAll(
    /<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g,
  )) {
    const id = readAttr(attrs, "id");
    if (id && !/\bviewBox=/i.test(attrs)) {
      simbolos.set(id, inner);
    }
  }
  if (simbolos.size === 0) {
    return svgXml;
  }

  const aplanados = new Set<string>();
  let resultado = svgXml.replace(
    /<use\b([^>]*?)(?:\/>|>[\s\S]*?<\/use>)/g,
    (completo, attrs: string) => {
      const id = readAttr(attrs, "href")?.replace(/^#/, "");
      const inner = id !== undefined ? simbolos.get(id) : undefined;
      if (id === undefined || inner === undefined) {
        return completo;
      }
      aplanados.add(id);

      const x = readAttr(attrs, "x");
      const y = readAttr(attrs, "y");
      // El `<use>` traslada DESPUÉS de aplicar su propio `transform`.
      const transform = [
        readAttr(attrs, "transform"),
        x !== undefined || y !== undefined
          ? `translate(${x ?? 0},${y ?? 0})`
          : undefined,
      ]
        .filter(Boolean)
        .join(" ");

      // `width`/`height` solo pintan algo con `viewBox`, que aquí no hay. El
      // resto de atributos (fill, opacity, class…) los hereda el grupo.
      const heredados = attrs.replace(
        /\s*\b(?:href|x|y|width|height|id|transform)="[^"]*"/g,
        "",
      );
      return `<g${heredados}${transform ? ` transform="${transform}"` : ""}>${inner}</g>`;
    },
  );

  for (const id of aplanados) {
    resultado = resultado.replace(
      new RegExp(
        `<symbol\\b[^>]*\\bid="${escapeRegExp(id)}"[^>]*>[\\s\\S]*?</symbol>`,
      ),
      "",
    );
  }
  return resultado;
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

  // Las referencias (`href` entre gradientes, `<use>` a un `<symbol>`) se
  // resuelven antes que los colores: así el inlinado de CSS ve ya las formas
  // reales y no las que estaban escondidas detrás de una referencia.
  const resuelto = flattenSymbols(inlineGradientStops(cleaned));

  return ensureViewBox(applyStylePaintPrecedence(inlineCssColors(resuelto)));
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
