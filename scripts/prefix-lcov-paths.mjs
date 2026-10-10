import { readFile, writeFile } from "node:fs/promises";

const [reportPath, sourcePrefix] = process.argv.slice(2);

if (!reportPath || !sourcePrefix || sourcePrefix.includes("..")) {
  throw new Error("Usage: node prefix-lcov-paths.mjs <report-path> <source-prefix>");
}

const report = await readFile(reportPath, "utf8");
const normalizedReport = report.replace(/^SF:(?!\/)(.+)$/gm, (_, sourcePath) => {
  const normalizedSourcePath = sourcePath
    .replaceAll("\\", "/")
    .replace(/^\.\.\/mobile\//, "");
  if (normalizedSourcePath.startsWith(`${sourcePrefix}/`)) {
    return `SF:${normalizedSourcePath}`;
  }
  return `SF:${sourcePrefix}/${normalizedSourcePath}`;
});

await writeFile(reportPath, normalizedReport);
