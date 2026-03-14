import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const assetDir = path.resolve("src/assets/opengraph");
const fontDir = path.resolve("src/assets/fonts/tex-gyre-heros");
const fontFiles = [
  path.join(fontDir, "texgyreheros-regular.otf"),
  path.join(fontDir, "texgyreheros-bold.otf"),
];

const entries = await readdir(assetDir, { withFileTypes: true });
const svgFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
  .map((entry) => entry.name);

for (const svgFile of svgFiles) {
  const inputPath = path.join(assetDir, svgFile);
  const outputPath = path.join(assetDir, svgFile.replace(/\.svg$/i, ".png"));
  const svg = await readFile(inputPath, "utf8");

  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: {
      fontFiles,
      loadSystemFonts: false,
      defaultFontFamily: "TeX Gyre Heros",
    },
  })
    .render()
    .asPng();

  await writeFile(outputPath, png);
  console.log(`generated ${path.relative(process.cwd(), outputPath)}`);
}
