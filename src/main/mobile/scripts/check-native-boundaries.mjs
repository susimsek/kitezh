import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const forbidden = [
  {
    label: "Web components",
    pattern: /from\s+["'][^"']*(?:src\/main\/web|react-bootstrap|next\/)/i,
  },
  {
    label: "Electron APIs",
    pattern: /(?:from|require\s*\()\s*["'][^"']*electron|window\.desktopApi/i,
  },
  {
    label: "Browser storage",
    pattern: /\b(?:localStorage|sessionStorage)\s*[.(]|document\./i,
  },
  {
    label: "DOM utilities",
    pattern: /HTMLElement|querySelector|document\.createElement\(/i,
  },
  {
    label: "Web test renderer",
    pattern: /@testing-library\/react(?:["']|\/)|fireEvent\.(?:click|change)\(/i,
  },
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedDirectories = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== "node_modules" &&
        entry.name !== "dist",
    )
    .map((entry) => sourceFiles(path.join(directory, entry.name)));
  const localFiles = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.(?:js|jsx|mjs|ts|tsx|json)$/.test(entry.name),
    )
    .map((entry) => path.join(directory, entry.name));
  return [...localFiles, ...(await Promise.all(nestedDirectories)).flat()];
}

const targets = [
  { name: "mobile", directory: path.join(root, "src") },
  { name: "shared", directory: path.resolve(root, "../shared/src") },
];
const targetFiles = (
  await Promise.all(
    targets.map(async (target) =>
      (await sourceFiles(target.directory)).map((filePath) => ({
        target,
        filePath,
      })),
    ),
  )
).flat();
const violations = (
  await Promise.all(
    targetFiles.map(async ({ target, filePath }) => {
      const contents = await readFile(filePath, "utf8");
      return forbidden.flatMap((rule) => {
        const match = rule.pattern.exec(contents);
        if (match?.index === undefined) return [];
        const line = contents.slice(0, match.index).split("\n").length;
        return [
          `${target.name}: ${path.relative(root, filePath)}:${line} uses ${rule.label}`,
        ];
      });
    }),
  )
).flat();

const packageManifest = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const appDependencies = {
  ...packageManifest.dependencies,
  ...packageManifest.devDependencies,
};
for (const dependency of ["react-dom", "react-native-web"]) {
  if (dependency in appDependencies) {
    violations.push(`package.json declares web-only dependency ${dependency}`);
  }
}
for (const [scriptName, script] of Object.entries(packageManifest.scripts ?? {})) {
  if (/expo\s+export\s+--platform\s+web|build:web/i.test(`${scriptName} ${script}`)) {
    violations.push(`package.json script ${scriptName} exports the web platform`);
  }
}

if (violations.length > 0) {
  console.error("Native boundary violations detected:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("Native boundary check passed for mobile and shared sources.");
}
