import { XMLValidator } from "fast-xml-parser";
import fs from "fs";
import path from "path";

import type { ChallengeMetadata } from "../src/types/challenge";
import { hexToHSV } from "../src/utils/color";
import { calculateColorScore } from "../src/utils/colorScore";
import { replaceColorInSvg, sanitizeSvgXml } from "../src/utils/svgMarkup";

/**
 * Revisión de todo el catálogo sin arrancar la app.
 *
 * Pasa cada logo por el mismo pipeline que el componente (`sanitizeSvgXml` +
 * `replaceColorInSvg`) y comprueba tres cosas que solo se ven jugando:
 * que el SVG resultante sigue siendo XML válido, que el color editable se
 * repinta de verdad (todos sus literales, no solo el primero) y que acertar el
 * color exacto puntúa 100.
 *
 *   npx tsx tools/checkLogos.ts            → todo el catálogo
 *   npx tsx tools/checkLogos.ts adidas dji → solo esos ids
 */

const CHALLENGES_PATH = path.join(process.cwd(), "generated", "challenges.json");

// Color sonda: un tono que no aparece en ningún logo real, para poder contar
// cuántas veces se ha aplicado la sustitución.
const PROBE = "#ABCDEF";

interface Issue {
  id: string;
  level: "error" | "warn";
  message: string;
}

function sourceLiterals(color: ChallengeMetadata["colors"][number]): string[] {
  if (color.svgColors && color.svgColors.length > 0) {
    return color.svgColors;
  }
  return [color.svgColor ?? color.hex];
}

/** Clases con `fill`/`stroke` que siguen sin volcarse a atributos tras limpiar. */
function findUninlinedClasses(original: string, sanitized: string): string[] {
  const painted = new Set<string>();
  for (const block of original.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []) {
    const css = block
      .replace(/<!\[CDATA\[/g, "")
      .replace(/\]\]>/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const ruleRegex = /([^{}]+)\{([^}]*)\}/g;
    let rule: RegExpExecArray | null;
    while ((rule = ruleRegex.exec(css)) !== null) {
      if (!/(?:^|[;\s])(?:fill|stroke)\s*:/i.test(rule[2])) {
        continue;
      }
      for (const selector of rule[1].split(",")) {
        const cls = selector.trim().match(/\.([a-zA-Z_][\w-]*)$/)?.[1];
        if (cls) {
          painted.add(cls);
        }
      }
    }
  }

  const missing: string[] = [];
  for (const cls of painted) {
    const elRegex = new RegExp(
      `<[a-zA-Z][^>]*\\bclass="[^"]*\\b${cls}\\b[^"]*"[^>]*>`,
      "gi",
    );
    for (const element of sanitized.match(elRegex) ?? []) {
      const hasPaint =
        /\bfill\s*=/i.test(element) ||
        /\bstroke\s*=/i.test(element) ||
        /\bstyle="[^"]*(?:fill|stroke)\s*:/i.test(element);
      if (!hasPaint) {
        missing.push(cls);
        break;
      }
    }
  }
  return missing;
}

/** `url(#id)` que apunta a un id que ya no existe (degradado roto). */
function findDanglingRefs(sanitized: string): string[] {
  const ids = new Set(
    [...sanitized.matchAll(/\sid="([^"]+)"/gi)].map((match) => match[1]),
  );
  const dangling = new Set<string>();
  for (const match of sanitized.matchAll(/url\(#([^)"']+)\)/gi)) {
    if (!ids.has(match[1])) {
      dangling.add(match[1]);
    }
  }
  return [...dangling];
}

function checkChallenge(challenge: ChallengeMetadata): Issue[] {
  const issues: Issue[] = [];
  const add = (level: Issue["level"], message: string): void => {
    issues.push({ id: challenge.id, level, message });
  };

  if (!challenge.svgXml) {
    add("error", "sin svgXml");
    return issues;
  }
  if (challenge.colors.length === 0) {
    add("error", "sin colores: no aparecerá nunca en el juego");
    return issues;
  }

  const sanitized = sanitizeSvgXml(challenge.svgXml);

  const validity = XMLValidator.validate(sanitized, { allowBooleanAttributes: true });
  if (validity !== true) {
    add("error", `XML inválido tras limpiar: ${validity.err.msg} (línea ${validity.err.line})`);
  }

  if (/<image\b/i.test(sanitized) || /base64/i.test(sanitized)) {
    add("warn", "contiene un bitmap incrustado: esa parte no se puede repintar");
  }

  const dangling = findDanglingRefs(sanitized);
  if (dangling.length > 0) {
    add("error", `referencias rotas: ${dangling.map((id) => `url(#${id})`).join(", ")}`);
  }

  const uninlined = findUninlinedClasses(challenge.svgXml, sanitized);
  if (uninlined.length > 0) {
    add(
      "error",
      `clases con color sin volcar (se pintarán en negro): ${uninlined.join(", ")}`,
    );
  }

  challenge.colors.forEach((color, index) => {
    const label = `color ${index + 1} (${color.hex})`;

    // El HSV guardado es lo que se compara con la predicción del jugador: si no
    // corresponde al hex que se pinta, acertar a ojo puntúa mal.
    const derived = hexToHSV(color.hex);
    if (
      Math.abs(derived.h - color.hsv.h) > 1 ||
      Math.abs(derived.s - color.hsv.s) > 1 ||
      Math.abs(derived.v - color.hsv.v) > 1
    ) {
      add("error", `${label}: hsv guardado ${JSON.stringify(color.hsv)} no corresponde al hex`);
    }

    const perfect = calculateColorScore(color.hsv, color.hsv);
    if (perfect !== 100) {
      add("error", `${label}: acertar el color exacto puntúa ${perfect}, no 100`);
    }

    const literals = sourceLiterals(color);
    const replaced = replaceColorInSvg(challenge.svgXml, literals, PROBE);
    const applied = (replaced.match(new RegExp(PROBE, "gi")) ?? []).length;

    if (applied === 0) {
      add("error", `${label}: el color no está en el SVG, no se repinta nada`);
      return;
    }

    // Ningún literal del grupo puede sobrevivir: lo que queda son trozos del
    // logo que se quedan del color original mientras el resto cambia.
    for (const literal of literals) {
      const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const leftover = (
        replaced.match(new RegExp(`${escaped}(?![0-9a-fA-F])`, "gi")) ?? []
      ).length;
      if (leftover > 0) {
        add("error", `${label}: quedan ${leftover} usos de ${literal} sin repintar`);
      }
    }
  });

  const primary = challenge.colors[challenge.editableColorIndex ?? 0];
  if (primary && primary.hsv.s <= 8) {
    add(
      "warn",
      `el color a adivinar es un gris (${primary.hex}): difícil de puntuar en un juego de color`,
    );
  }

  return issues;
}

const catalog: ChallengeMetadata[] = JSON.parse(
  fs.readFileSync(CHALLENGES_PATH, "utf8"),
);

const filter = process.argv.slice(2);
const targets =
  filter.length > 0
    ? catalog.filter((challenge) => filter.includes(challenge.id))
    : catalog;

const allIssues = targets.flatMap(checkChallenge);
const errors = allIssues.filter((issue) => issue.level === "error");
const warnings = allIssues.filter((issue) => issue.level === "warn");

const byId = new Map<string, Issue[]>();
for (const issue of allIssues) {
  byId.set(issue.id, [...(byId.get(issue.id) ?? []), issue]);
}

console.log(`\nRevisados ${targets.length} logos.\n`);
for (const [id, issues] of byId) {
  console.log(`  ${id}`);
  for (const issue of issues) {
    console.log(`    ${issue.level === "error" ? "✗" : "!"} ${issue.message}`);
  }
}

console.log(
  `\n${targets.length - byId.size} sin incidencias · ${errors.length} error(es) · ${warnings.length} aviso(s)\n`,
);

process.exitCode = errors.length > 0 ? 1 : 0;
