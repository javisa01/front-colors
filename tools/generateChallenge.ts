import convert from "color-convert";
import fs from "fs";
import path from "path";

const NAME = "spotify";

const svgPath = path.join(process.cwd(), "assets", "logos", `${NAME}.svg`);

const outDir = path.join(process.cwd(), "src", "generated", NAME);

const svg = fs.readFileSync(svgPath, "utf8");

// Primer color encontrado
const match = svg.match(/fill="(#[0-9A-Fa-f]{6})"/);

if (!match) {
  throw new Error("No se encontró ningún color.");
}

const editableColor = match[1];

const rgb = convert.hex.rgb(editableColor.replace("#", ""));
const [h, s, v] = convert.rgb.hsv(rgb);

fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, "metadata.json"),
  JSON.stringify(
    {
      name: NAME,
      target: {
        hex: editableColor,
        h,
        s,
        v,
      },
    },
    null,
    2,
  ),
);

let component = svg
  .replace('<?xml version="1.0" encoding="UTF-8" standalone="no"?>', "")
  .replace('<svg xmlns="http://www.w3.org/2000/svg"', "<Svg")
  .replace("</svg>", "</Svg>")
  .replace(editableColor, "{editableColor}");

component = `
import Svg, { Path } from "react-native-svg";

interface Props{
    width?:number;
    height?:number;
    editableColor:string;
}

export default function Logo({
    width=250,
    height=250,
    editableColor
}:Props){

return(
${component}
);

}
`;

component = component
  .replace(/<path/g, "<Path")
  .replace(/<\/path>/g, "</Path>")
  .replace(/viewBox=/g, "viewBox=")
  .replace(/fill="\{editableColor\}"/g, "fill={editableColor}")
  .replace(
    /<Svg([^>]*)viewBox=/,
    "<Svg width={width} height={height} $1viewBox=",
  );

fs.writeFileSync(path.join(outDir, "Logo.tsx"), component);

console.log("Challenge generado.");
