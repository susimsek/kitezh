import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const releaseDirectory = path.resolve(
  process.argv[2] ?? path.join(desktopDirectory, "release"),
);
const outputDirectory = path.resolve(
  process.argv[3] ?? path.join(desktopDirectory, "release-assets"),
);

const distributablePattern =
  /\.(AppImage|appx|deb|dmg|exe|rpm|snap|zip|tar\.gz|blockmap)$/i;
const metadataPattern = /^latest.*\.yml(?:\.sig)?$/i;
const checksumPattern = /^SHA256SUMS(?:\.asc)?$/;
const sigstoreBundlePattern = /\.sigstore\.json$/i;

const entries = await readdir(releaseDirectory, { withFileTypes: true });
const assets = entries
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter(
    (name) =>
      distributablePattern.test(name) ||
      metadataPattern.test(name) ||
      checksumPattern.test(name) ||
      sigstoreBundlePattern.test(name),
  );

if (assets.length === 0) {
  throw new Error(
    `No distributable release assets found in ${releaseDirectory}`,
  );
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  assets.map((asset) =>
    cp(path.join(releaseDirectory, asset), path.join(outputDirectory, asset)),
  ),
);

console.log(
  `Collected ${assets.length} release asset(s) in ${outputDirectory}.`,
);
