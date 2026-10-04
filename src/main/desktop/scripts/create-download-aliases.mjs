import { copyFile, readdir } from "node:fs/promises";
import path from "node:path";

const releaseDirectory = path.resolve(
  process.argv[2] ?? path.join("src", "main", "desktop", "release"),
);

const aliasRules = [
  [/^kitezh-.*-win-x64-setup\.exe$/, "kitezh-windows-x64-setup.exe"],
  [/^kitezh-.*-win-x64-portable\.exe$/, "kitezh-windows-x64-portable.exe"],
  [/^kitezh-.*-win-x64-appx\.appx$/, "kitezh-windows-x64-appx.appx"],
  [/^kitezh-.*-linux-x86_64\.AppImage$/, "kitezh-linux-x64.AppImage"],
  [/^kitezh-.*-linux-amd64\.deb$/, "kitezh-linux-x64.deb"],
  [/^kitezh-.*-linux-x86_64\.rpm$/, "kitezh-linux-x64.rpm"],
  [/^kitezh-.*-linux-amd64\.snap$/, "kitezh-linux-x64.snap"],
  [/^kitezh-.*-linux-arm64\.AppImage$/, "kitezh-linux-arm64.AppImage"],
  [/^kitezh-.*-linux-arm64\.deb$/, "kitezh-linux-arm64.deb"],
  [/^kitezh-.*-macos-universal\.dmg$/, "kitezh-macos-universal.dmg"],
  [/^kitezh-.*-macos-universal\.zip$/, "kitezh-macos-universal.zip"],
  [/^kitezh-.*-macos-x64\.dmg$/, "kitezh-macos-x64.dmg"],
  [/^kitezh-.*-macos-x64\.zip$/, "kitezh-macos-x64.zip"],
];

const entries = await readdir(releaseDirectory, { withFileTypes: true });
const releaseFiles = entries
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);

const aliases = aliasRules.flatMap(([pattern, alias]) => {
  const source = releaseFiles.find((file) => pattern.test(file));
  return source ? [{ source, alias }] : [];
});

if (aliases.length === 0) {
  throw new Error(`No release artifacts found in ${releaseDirectory}`);
}

await Promise.all(
  aliases.map(({ source, alias }) =>
    copyFile(path.join(releaseDirectory, source), path.join(releaseDirectory, alias)),
  ),
);

console.log(
  `Created ${aliases.length} stable download alias(es): ${aliases
    .map(({ alias }) => alias)
    .join(", ")}`,
);
