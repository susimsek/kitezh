import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
    pattern: /HTMLElement|querySelector|createElement\(/i,
  },
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(filePath)));
    else if (
      /\.(?:js|jsx|mjs|ts|tsx|json)$/.test(entry.name) &&
      !entry.name.endsWith(".coverage.test.tsx")
    ) {
      files.push(filePath);
    }
  }
  return files;
}

const targets = [
  { name: "mobile", directory: path.join(root, "src") },
  { name: "shared", directory: path.resolve(root, "../shared/src") },
];
const violations = [];

for (const target of targets) {
  for (const filePath of await sourceFiles(target.directory)) {
    const contents = await readFile(filePath, "utf8");
    for (const rule of forbidden) {
      const match = contents.match(rule.pattern);
      if (!match) continue;
      const line = contents.slice(0, match.index).split("\n").length;
      violations.push(
        `${target.name}: ${path.relative(root, filePath)}:${line} uses ${rule.label}`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("Native boundary violations detected:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("Native boundary check passed for mobile and shared sources.");
}
