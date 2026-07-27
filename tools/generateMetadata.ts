import convert from "color-convert";
import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import path from "path";

interface SVGColor {
  hex: string;
  hsv: {
    h: number;
    s: number;
    v: number;
  };
}

const LOGO_DIR = path.join(process.cwd(), "assets", "logos");
const OUTPUT_DIR = path.join(process.cwd(), "generated");

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
});

function toSafeIdentifier(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_$]/g, "_");
  return sanitized.match(/^\d/) ? `_${sanitized}` : sanitized;
}

function visit(node: unknown, colors: Set<string>) {
  if (Array.isArray(node)) {
    node.forEach((child) => visit(child, colors));
    return;
  }

  if (!node || typeof node !== "object") {
    return;
  }

  const current = node as Record<string, unknown>;

  if (typeof current.fill === "string") {
    const fill = current.fill.trim();

    if (/^#[0-9a-fA-F]{6}$/.test(fill)) {
      colors.add(fill.toUpperCase());
    }
  }

  for (const value of Object.values(current)) {
    visit(value, colors);
  }
}

function hexToHSV(hex: string) {
  const rgb = convert.hex.rgb(hex.replace("#", ""));

  const [h, s, v] = convert.rgb.hsv(rgb);

  return { h, s, v };
}

function processSVG(file: string) {
  const fullPath = path.join(LOGO_DIR, file);

  const xml = fs.readFileSync(fullPath, "utf8");

  const parsed = parser.parse(xml);

  const colors = new Set<string>();

  visit(parsed, colors);

  const metadata: SVGColor[] = [...colors].map((hex) => ({
    hex,
    hsv: hexToHSV(hex),
  }));

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
        colors: metadata,
      },
      null,
      2,
    ),
  );

  return {
    id: name,
    colors: metadata.length,
  };
}

const files = fs
  .readdirSync(LOGO_DIR)
  .filter((f: string) => f.endsWith(".svg"));

const manifest = files.map(processSVG);

const challengeCatalog = files.map((file) => {
  const name = path.basename(file, ".svg");
  const metadataPath = path.join(OUTPUT_DIR, name, "metadata.json");
  return JSON.parse(fs.readFileSync(metadataPath, "utf8"));
});

fs.writeFileSync(
  path.join(OUTPUT_DIR, "challenges.json"),
  JSON.stringify(challengeCatalog, null, 2),
);

fs.writeFileSync(
  path.join(OUTPUT_DIR, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);

console.log(`Procesados ${manifest.length} SVG.`);
