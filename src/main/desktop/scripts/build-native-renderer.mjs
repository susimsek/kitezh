import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
const {
  colors,
  controlSizes,
  radii,
  spacing,
  typography,
} = require("@kitezh/shared/theme");

function cssVariables(palette) {
  return Object.entries({
    ...palette,
    focus: palette.primary,
    onDanger:
      palette === colors.dark ? colors.light.text : colors.light.surface,
    warning: palette.textMuted,
    controlCompact: `${controlSizes.desktopCompact}px`,
    controlDefault: `${controlSizes.desktopDefault}px`,
    radiusControl: `${radii.sm}px`,
    spaceSmall: `${spacing.sm}px`,
    spaceMedium: `${spacing.md}px`,
    bodySize: `${typography.body}px`,
  })
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
await mkdir(path.join(outputDirectory, "brand"), { recursive: true });
for (const name of ["logo-light.svg", "logo-dark.svg"]) {
  await copyFile(
    path.join(desktopDirectory, "assets", "brand", name),
    path.join(outputDirectory, "brand", name),
  );
}
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
const rendererSource = await readFile(
  path.join(sourceDirectory, "renderer.mjs"),
  "utf8",
);
const userMessageSource = await readFile(
  path.join(sourceDirectory, "user-messages.mjs"),
  "utf8",
);
const messageImport = 'import { userMessages } from "./user-messages.mjs";';
if (!rendererSource.includes(messageImport)) {
  throw new Error("Native user message import was not found");
}
// The custom protocol serves one renderer module. Bundle this data-only catalog into it.
await writeFile(
  path.join(outputDirectory, "renderer.mjs"),
  rendererSource
    .replace(
      'import { createGroupScreens } from "./groups.mjs";',
      (
        await readFile(path.join(sourceDirectory, "groups.mjs"), "utf8")
      ).replaceAll("export function", "function"),
    )
    .replace(
      'import { createRoleScreens } from "./roles.mjs";',
      (
        await readFile(path.join(sourceDirectory, "roles.mjs"), "utf8")
      ).replaceAll("export function", "function"),
    )
    .replace(
      'import { createOrganizationScreens } from "./organizations.mjs";',
      (
        await readFile(path.join(sourceDirectory, "organizations.mjs"), "utf8")
      ).replaceAll("export function", "function"),
    )
    .replace(messageImport, userMessageSource.replace("export const", "const")),
);
