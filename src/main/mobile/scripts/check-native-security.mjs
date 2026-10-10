import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forbidden = [
  {
    label: "diagnostic secret logging",
    pattern: /console\.(?:log|info|debug|warn|error)\s*\(/,
  },
  {
    label: "token in a URL query",
    pattern: /[?&](?:access_token|refresh_token|id_token)=/i,
  },
  {
    label: "password or token in a diagnostic string",
    pattern:
      /(?:console|logger|diagnostic)[^\n]{0,80}(?:password|accessToken|refreshToken|idToken)/i,
  },
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(filePath)));
    else if (/\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name)) files.push(filePath);
  }
  return files;
}

const violations = [];
for (const filePath of await sourceFiles(path.join(root, "src"))) {
  const contents = await readFile(filePath, "utf8");
  for (const rule of forbidden) {
    const match = contents.match(rule.pattern);
    if (match) {
      const line = contents.slice(0, match.index).split("\n").length;
      violations.push(
        `${path.relative(root, filePath)}:${line} uses ${rule.label}`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("Native security violations detected:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(
    "Native security check passed without secret logging or token-bearing URLs.",
  );
}
