import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/sanitize-roster-csv.mjs <input.csv> [output.csv]");
  process.exit(1);
}

const outputPath = process.argv[3] ?? (() => {
  const ext = path.extname(inputPath);
  if (ext.toLowerCase() === ".csv") {
    return inputPath.replace(/\.csv$/i, "-sanitized.csv");
  }
  return `${inputPath}-sanitized.csv`;
})();

const normalizeField = (value) => {
  let next = value.trim();
  if (next.startsWith("\"") && next.endsWith("\"")) {
    next = next.slice(1, -1).replace(/""/g, "\"");
  }
  return next;
};

const escapeField = (value) => {
  const next = normalizeField(value);
  if (next.includes("\"") || next.includes(",")) {
    return `"${next.replace(/"/g, "\"\"")}"`;
  }
  return next;
};

const run = async () => {
  const raw = await readFile(inputPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const output = [lines[0]];
  for (const line of lines.slice(1)) {
    const parts = line.split(",");
    if (parts.length < 4) {
      output.push(line);
      continue;
    }
    const name = parts.slice(0, -3).join(",");
    const promotion = parts[parts.length - 3];
    const gender = parts[parts.length - 2];
    const rosterYear = parts[parts.length - 1];
    output.push(
      [
        escapeField(name),
        normalizeField(promotion),
        normalizeField(gender),
        normalizeField(rosterYear),
      ].join(",")
    );
  }

  await writeFile(outputPath, output.join("\n"), "utf-8");
  console.log(`Sanitized CSV written to ${outputPath}`);
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
