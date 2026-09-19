import fs from "fs";
import path from "path";

/**
 * Importa banderas de `flag-icons` al área de staging `assets/logos`, listas
 * para que `npm run generate` las convierta en retos.
 *
 * Por qué banderas: la mecánica del juego necesita que la imagen tenga un color
 * *canónico* (sabes que Suecia es azul, la gracia es clavar qué azul). Una
 * ilustración genérica no lo tiene — un vaso de café puede ser de cualquier
 * color — y un logo de marca sí, pero con el problema legal de siempre. Las
 * banderas son lo único que reúne las dos cosas: color oficial especificado y
 * cero titular al que pedir permiso.
 *
 * Licencia: `flag-icons` es MIT, que autoriza explícitamente «modify, merge,
 * publish, distribute, sublicense, and/or sell». La única obligación es
 * conservar el aviso de copyright — está en `assets/CREDITS.md`. Además, la
 * bandera en sí es emblema estatal: lo que cubre el MIT es el trabajo de
 * vectorización, no el diseño.
 *
 * El script NO extrae colores: de eso ya se encarga `generateMetadata.ts`, que
 * resuelve `fill`/`style`/clases, expande `#fc0`, traduce `gold` y `red`, y
 * recorre el árbol entero (Japón usa `clipPath`, India usa `<use>`). Aquí solo
 * se descarga, se filtra, se renombra y se anota la procedencia.
 *
 * Uso:
 *   npm run import:flags -- --all         # todas las que pasan el filtro
 *   npm run import:flags                  # los 10 de prueba de DEFAULT_FLAGS
 *   npm run import:flags -- se jp br      # códigos ISO sueltos
 *   npm run import:flags -- --all --max-kb 24   # descarta las más pesadas
 *
 * Después: `npm run generate` (es aditivo, no toca el resto del catálogo).
 */

const REPO = "lipis/flag-icons";
const BRANCH = "main";
const LICENSE = "MIT";
const LICENSE_URL = `https://github.com/${REPO}/blob/${BRANCH}/LICENSE`;
const AUTHOR = "Panayiotis Lipiridis — flag-icons";

/** Prefijo de id y categoría. Dejan sitio a futuras tandas (`fruit-`, `sign-`). */
const PREFIX = "flag-";
const CATEGORY = "flag";

const LOGO_DIR = path.join(process.cwd(), "assets", "logos");
const SOURCES_PATH = path.join(process.cwd(), "assets", "sources.json");

/**
 * Los diez de prueba, cuando no se pide `--all`. Elegidos por reconocibilidad y
 * por repartir el tono, con dos azules (`se`/`ua`) y dos rojos (`jp`/`ca`) a
 * propósito: que dos retos compartan familia de color es justo donde el juego se
 * pone interesante.
 */
const DEFAULT_FLAGS = [
  "se", "jp", "br", "in", "ua",
  "za", "jm", "ca", "bw", "de",
];

/**
 * # Qué banderas NO se importan
 *
 * El juego **recolorea** la imagen. Eso convierte en problema cosas que en un
 * quiz de banderas normal no lo serían, y por eso el filtro es más estricto de
 * lo que parece necesario.
 *
 * ## 1. Solo códigos ISO 3166-1 de dos letras
 *
 * El repo trae además emblemas de organizaciones (`arab`, `asean`, `cefta`,
 * `eac`) y banderas subestatales (`es-ct`, `es-pv`, `es-ga`, `gb-eng`,
 * `gb-sct`, `gb-wls`, `gb-nir`, `sh-ac`, `sh-hl`, `sh-ta`). Las primeras son
 * emblemas de entidad, no de Estado; las segundas son política interna que no
 * aporta nada a un juego de color. La regla «solo ISO-2» las deja fuera todas
 * de una vez, sin tener que justificar cada caso.
 *
 * ## 2. Escritura religiosa — `RELIGIOUS_SCRIPT`
 *
 * Es la exclusión que de verdad importa y la que no se aplicaría en un quiz
 * normal. Estas banderas llevan la *shahada*, el *takbir* o caligrafía
 * coránica. Cambiarles el color no es un riesgo legal: es una ofensa directa, y
 * la mecánica del juego consiste exactamente en eso.
 *
 * ## 3. Emblemas protegidos — `PROTECTED_EMBLEM`
 *
 * La bandera de un Estado se puede representar; el emblema europeo y el de la
 * ONU no funcionan igual. Ambos exigen autorización previa para su uso, con su
 * propio régimen al margen del de las banderas nacionales.
 *
 * ## 4. Soberanía no reconocida de forma universal — `CONTESTED`
 *
 * No es una opinión sobre quién tiene razón: es que las tiendas retiran apps
 * por mercado cuando aparecen estas banderas. La línea es el reconocimiento de
 * la *estatalidad*, no el trazado de fronteras — por eso Israel, que es Estado
 * miembro de la ONU, no está en esta lista.
 *
 * Los territorios dependientes (Puerto Rico, Hong Kong, Groenlandia…) sí entran:
 * tienen código ISO propio y su bandera no la discute nadie.
 */
const RELIGIOUS_SCRIPT: Record<string, string> = {
  sa: "shahada",
  af: "shahada",
  iq: "takbir",
  ir: "caligrafía coránica",
  bn: "inscripción árabe en el escudo",
};

const PROTECTED_EMBLEM: Record<string, string> = {
  eu: "emblema europeo: uso sujeto a autorización del Consejo de Europa",
  un: "emblema de la ONU: uso sujeto a autorización",
};

const CONTESTED: Record<string, string> = {
  tw: "estatalidad no reconocida universalmente",
  xk: "estatalidad no reconocida universalmente",
  eh: "estatalidad no reconocida universalmente",
  ps: "estatalidad no reconocida universalmente",
};

/**
 * Códigos de dos letras que el repo usa para algo que no es un Estado. Pasan el
 * filtro de forma ISO-2 y hay que nombrarlos uno a uno.
 */
const NOT_A_STATE: Record<string, string> = {
  ic: "Canarias: subdivisión, no Estado",
  ea: "Ceuta y Melilla: subdivisión, no Estado",
  pc: "Comunidad del Pacífico: organización, no Estado",
  // Rectángulo gris con un interrogante. Además de no ser una bandera, su único
  // color es un gris desaturado: como reto de color es imposible de adivinar.
  xx: "marcador de «bandera desconocida», no es una bandera",
};

const EXCLUDED: Record<string, string> = {
  ...RELIGIOUS_SCRIPT,
  ...PROTECTED_EMBLEM,
  ...CONTESTED,
  ...NOT_A_STATE,
};

/**
 * Cuándo la heurística del generador se equivoca de color jugable.
 *
 * `pickPrimaryIndex` elige el color cromático que pinta más formas, y en una
 * bandera eso falla cuando el emblema central está troceado: el chakra de India
 * son veintitantas piezas azules de dos milímetros y le gana al naranja del
 * tercio superior, que es una sola forma enorme. Brasil es el otro caso: el SVG
 * trae dos verdes a distancia 17.8 (justo por encima del umbral de fusión) y el
 * secundario acaba de principal.
 *
 * Se declara por hex y no por índice porque el índice depende del orden de las
 * formas y cambia al regenerar.
 */
const PRIMARY_OVERRIDES: Record<string, string> = {
  in: "#FF9933", // azafrán, no el azul del chakra
  br: "#229E45", // el verde grande, no el segundo verde del escudo
};

interface SourceEntry {
  name: string;
  category: string;
  source: string;
  license: string;
  licenseUrl: string;
  author: string;
  note?: string;
  editableColorHex?: string;
}

interface Options {
  ratio: string;
  codes: string[] | null; // null = --all
  maxKb: number | null;
}

function parseArgs(argv: string[]): Options {
  let ratio = "4x3";
  let all = false;
  let maxKb: number | null = null;
  const codes: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--ratio") {
      const value = argv[i + 1];
      if (value !== "4x3" && value !== "1x1") {
        throw new Error(`--ratio solo acepta 4x3 o 1x1 (recibido: ${value})`);
      }
      ratio = value;
      i += 1;
      continue;
    }
    if (arg === "--max-kb") {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`--max-kb necesita un número (recibido: ${argv[i + 1]})`);
      }
      maxKb = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Opción desconocida: ${arg}`);
    }
    codes.push(arg.toLowerCase());
  }

  if (all && codes.length > 0) {
    throw new Error("--all y una lista de códigos son excluyentes.");
  }

  return {
    ratio,
    codes: all ? null : codes.length > 0 ? codes : DEFAULT_FLAGS,
    maxKb,
  };
}

/** Lista los códigos disponibles en el repo, con su tamaño, en una sola llamada. */
async function listRepoFlags(
  ratio: string,
): Promise<{ code: string; size: number }[]> {
  const url = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) {
    throw new Error(
      `No se pudo listar el repo (HTTP ${response.status}). ` +
        "Con --all hace falta llegar a api.github.com.",
    );
  }

  const tree = (await response.json()) as {
    tree: { path: string; size?: number }[];
  };
  const prefix = `flags/${ratio}/`;

  return tree.tree
    .filter((item) => item.path.startsWith(prefix) && item.path.endsWith(".svg"))
    .map((item) => ({
      code: item.path.slice(prefix.length, -".svg".length),
      size: item.size ?? 0,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Nombre del territorio en español. `Intl.DisplayNames` cubre los 250 códigos
 * ISO sin tener que mantener una tabla a mano.
 */
const regionNames = new Intl.DisplayNames(["es"], {
  type: "region",
  fallback: "none",
});

function displayName(code: string): string {
  try {
    return regionNames.of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

async function download(code: string, ratio: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/flags/${ratio}/${code}.svg`;
  const response = await fetch(url);

  if (response.status === 404) {
    throw new Error("no existe en el repo (¿código ISO mal escrito?)");
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xml = await response.text();
  // GitHub devuelve 200 con una página de error en algunos fallos de CDN, así
  // que no basta con el status: hay que ver que de verdad sea un SVG.
  if (!xml.trimStart().startsWith("<svg")) {
    throw new Error("la respuesta no es un SVG");
  }
  return xml;
}

function readSources(): Record<string, SourceEntry> {
  if (!fs.existsSync(SOURCES_PATH)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(SOURCES_PATH, "utf8"));
}

/** Motivo por el que un código se queda fuera, o null si entra. */
function rejectionReason(code: string): string | null {
  if (!/^[a-z]{2}$/.test(code)) {
    return "no es un código ISO 3166-1 de dos letras";
  }
  return EXCLUDED[code] ?? null;
}

async function main(): Promise<void> {
  const { ratio, codes, maxKb } = parseArgs(process.argv.slice(2));

  fs.mkdirSync(LOGO_DIR, { recursive: true });
  const sources = readSources();

  // Con `--all` se listan del repo (trae el tamaño, que es lo que permite
  // aplicar `--max-kb` sin descargar primero). Con códigos sueltos se confía en
  // lo que pida quien llama.
  const candidates = codes
    ? codes.map((code) => ({ code, size: 0 }))
    : await listRepoFlags(ratio);

  const rejected: string[] = [];
  const tooBig: string[] = [];
  const wanted = candidates.filter(({ code, size }) => {
    const reason = rejectionReason(code);
    if (reason) {
      rejected.push(`${code} (${reason})`);
      return false;
    }
    if (maxKb != null && size > maxKb * 1024) {
      tooBig.push(`${code} (${Math.round(size / 1024)} KB)`);
      return false;
    }
    return true;
  });

  console.log(
    `\n${candidates.length} candidata(s) · ${wanted.length} a descargar · ` +
      `${rejected.length} filtrada(s)${maxKb != null ? ` · ${tooBig.length} por peso` : ""}\n`,
  );

  const ok: string[] = [];
  const failed: string[] = [];
  let bytes = 0;

  for (const { code } of wanted) {
    const id = `${PREFIX}${code}`;
    try {
      const xml = await download(code, ratio);
      fs.writeFileSync(path.join(LOGO_DIR, `${id}.svg`), xml);
      bytes += Buffer.byteLength(xml);

      sources[id] = {
        name: `Bandera de ${displayName(code)}`,
        category: CATEGORY,
        source: `https://github.com/${REPO}/blob/${BRANCH}/flags/${ratio}/${code}.svg`,
        license: LICENSE,
        licenseUrl: LICENSE_URL,
        author: AUTHOR,
        note: "Emblema estatal: el MIT cubre la vectorización, no el diseño.",
        ...(PRIMARY_OVERRIDES[code]
          ? { editableColorHex: PRIMARY_OVERRIDES[code] }
          : {}),
      };

      ok.push(id);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.log(`  ✗  ${id.padEnd(10)} ${reason}`);
      failed.push(id);
    }
  }

  const ordered = Object.fromEntries(
    Object.entries(sources).sort(([a], [b]) => a.localeCompare(b)),
  );
  fs.writeFileSync(SOURCES_PATH, `${JSON.stringify(ordered, null, 2)}\n`);

  if (rejected.length > 0) {
    console.log("Filtradas por política (ver el comentario de EXCLUDED):");
    for (const line of rejected) {
      console.log(`  - ${line}`);
    }
    console.log();
  }

  if (tooBig.length > 0) {
    console.log(`Filtradas por --max-kb ${maxKb}:`);
    console.log(`  ${tooBig.join(", ")}\n`);
  }

  console.log(
    `${ok.length} descargada(s) (${(bytes / 1024 / 1024).toFixed(2)} MB), ` +
      `${failed.length} con error.`,
  );
  console.log(
    `Procedencia anotada en assets/sources.json (${Object.keys(ordered).length} entradas).`,
  );

  if (ok.length > 0) {
    console.log("\nSiguiente: npm run generate");
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
