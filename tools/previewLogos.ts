import fs from "fs";
import path from "path";

import type { ChallengeMetadata } from "../src/types/challenge";
import { getChallengeBackgroundTheme } from "../src/utils/color";
import { replaceColorInSvg, sanitizeSvgXml } from "../src/utils/svgMarkup";

/**
 * Vuelca los logos ya procesados a un HTML: a la izquierda como se pintan y a
 * la derecha con el color editable cambiado. Sirve para mirar de un vistazo si
 * algún SVG se rompe al limpiarlo o si el cambio de color pinta lo que no debe.
 *
 *   npx tsx tools/previewLogos.ts salida.html [id...]
 */

const CHALLENGES_PATH = path.join(process.cwd(), "generated", "challenges.json");
const SWAP_COLOR = "#00E5FF";

const [outArg, ...ids] = process.argv.slice(2);
const outPath = path.resolve(outArg ?? "logos-preview.html");

const catalog: ChallengeMetadata[] = JSON.parse(
  fs.readFileSync(CHALLENGES_PATH, "utf8"),
);
const targets =
  ids.length > 0 ? catalog.filter((item) => ids.includes(item.id)) : catalog;

const cards = targets
  .map((challenge) => {
    const index = challenge.editableColorIndex ?? 0;
    const color = challenge.colors[index];
    const literals = color?.svgColors ?? (color?.svgColor ? [color.svgColor] : color ? [color.hex] : []);
    const original = sanitizeSvgXml(challenge.svgXml);
    const swapped =
      literals.length > 0
        ? replaceColorInSvg(challenge.svgXml, literals, SWAP_COLOR)
        : original;

    // Mismo fondo que elegiría la app, para ver el logo con el contraste real.
    const theme = getChallengeBackgroundTheme(challenge);
    const boxStyle = `background:${theme.background};border-color:${theme.border}`;

    return `<article>
  <h2>${challenge.id} <small>${color?.hex ?? "sin color"} · ${challenge.colors.length} color(es)</small></h2>
  <div class="pair">
    <div class="box" style="${boxStyle}">${original}</div>
    <div class="box" style="${boxStyle}">${swapped}</div>
  </div>
</article>`;
  })
  .join("\n");

const html = `<!doctype html>
<meta charset="utf-8">
<title>Preview logos</title>
<style>
  body { background:#111113; color:#eee; font:14px system-ui; margin:24px; }
  article { margin-bottom:28px; }
  h2 { font-size:15px; margin:0 0 8px; font-weight:600; }
  small { color:#8a8a8f; font-weight:400; }
  .pair { display:flex; gap:16px; }
  .box { width:220px; height:220px; background:#1b1b1f; border:1px solid #303036;
         border-radius:14px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .box svg { max-width:88%; max-height:88%; }
</style>
${cards}
`;

fs.writeFileSync(outPath, html);
console.log(`${targets.length} logos → ${outPath}`);
