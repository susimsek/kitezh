import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceDirectory = path.join(desktopDirectory, "src", "native");
const outputDirectory = path.join(desktopDirectory, "dist", "native");
const require = createRequire(import.meta.url);
const { colors } = require("@kitezh/shared/theme");

function cssVariables(palette) {
  return Object.entries(palette)
    .map(([name, value]) => {
      const tokenName = name.replace(
        /[A-Z]/g,
        (character) => `-${character.toLowerCase()}`,
      );
      return `--${tokenName}: ${value};`;
    })
    .join("\n        ");
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
const nativeHtml = await readFile(
  path.join(sourceDirectory, "native.html"),
  "utf8",
);
const renderedHtml = nativeHtml
  .replace("/* SHARED_LIGHT_THEME_TOKENS */", cssVariables(colors.light))
  .replace("/* SHARED_DARK_THEME_TOKENS */", cssVariables(colors.dark));
if (renderedHtml.includes("SHARED_")) {
  throw new Error("Native theme token placeholders were not fully rendered");
}
await writeFile(path.join(outputDirectory, "native.html"), renderedHtml);
await cp(
  path.join(sourceDirectory, "renderer.mjs"),
  path.join(outputDirectory, "renderer.mjs"),
);
