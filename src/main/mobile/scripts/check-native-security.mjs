import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
      (entry) => entry.isFile() && /\.(?:js|jsx|mjs|ts|tsx)$/.test(entry.name),
    )
    .map((entry) => path.join(directory, entry.name));
  return [...localFiles, ...(await Promise.all(nestedDirectories)).flat()];
}

const files = await sourceFiles(path.join(root, "src"));
const violations = (
  await Promise.all(
    files.map(async (filePath) => {
      const contents = await readFile(filePath, "utf8");
      return forbidden.flatMap((rule) => {
        const match = rule.pattern.exec(contents);
        if (match?.index === undefined) return [];
        const line = contents.slice(0, match.index).split("\n").length;
        return [`${path.relative(root, filePath)}:${line} uses ${rule.label}`];
      });
    }),
  )
).flat();

if (violations.length > 0) {
  console.error("Native security violations detected:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(
    "Native security check passed without secret logging or token-bearing URLs.",
  );
}
