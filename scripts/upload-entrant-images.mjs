import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const loadEnvFile = async (filePath) => {
  try {
    const raw = await readFile(filePath, "utf-8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const equalsIndex = trimmed.indexOf("=");
      if (equalsIndex === -1) return;
      const key = trimmed.slice(0, equalsIndex).trim();
      const value = trimmed.slice(equalsIndex + 1).trim();
      if (!key || process.env[key]) return;
      process.env[key] = value.replace(/^['"]|['"]$/g, "");
    });
  } catch {
    // ignore missing .env
  }
};

await loadEnvFile(resolve("scripts/.env"));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "entrant-images";
const ROSTER_YEAR = process.env.ROSTER_YEAR ? Number(process.env.ROSTER_YEAR) : 2026;
const PROMOTION = (process.env.ROSTER_PROMOTION || "WWE").trim();
const aliasTemplateOut = process.env.IMAGE_ALIAS_TEMPLATE_OUT;
const enableFuzzy = process.env.ENABLE_FUZZY_MATCH === "true";
const fuzzyMaxDistance = process.env.FUZZY_MAX_DISTANCE
  ? Number(process.env.FUZZY_MAX_DISTANCE)
  : 2;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing env vars: SUPABASE_URL, SUPABASE_SECRET_KEY");
  process.exit(1);
}

const inputFiles = process.argv.slice(2);
if (inputFiles.length === 0) {
  console.error("Provide one or more JSON files with name/image_url pairs.");
  process.exit(1);
}
const aliasFile = process.env.IMAGE_ALIAS_FILE;

const request = async (url, options) => {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res;
};

const normalizeName = (value) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const slugify = (value) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const loadMappings = async () => {
  const mappings = [];
  for (const file of inputFiles) {
    const raw = await readFile(file, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      throw new Error(`Expected array in ${file}`);
    }
    data.forEach((item) => {
      if (item && typeof item === "object") {
        const name = item.name ?? item.title ?? "";
        const image_url = item.image_url ?? item.imageUrl ?? item.image ?? null;
        if (name && image_url) {
          mappings.push({ name, image_url });
        }
      }
    });
  }
  return mappings;
};

const loadAliases = async () => {
  if (!aliasFile) return new Map();
  const raw = await readFile(aliasFile, "utf-8");
  const data = JSON.parse(raw);
  const entries = Array.isArray(data)
    ? data
    : typeof data === "object" && data
      ? Object.entries(data).map(([from, to]) => ({ from, to }))
      : [];
  const map = new Map();
  entries.forEach((entry) => {
    if (!entry) return;
    const from = entry.from ?? entry[0];
    const to = entry.to ?? entry[1];
    if (typeof from === "string" && typeof to === "string") {
      map.set(normalizeName(from), to);
    }
  });
  return map;
};

const levenshtein = (a, b) => {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  const matrix = Array.from({ length: aLen + 1 }, () =>
    new Array(bLen + 1).fill(0)
  );
  for (let i = 0; i <= aLen; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= aLen; i += 1) {
    for (let j = 1; j <= bLen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[aLen][bLen];
};

const getClosestMatches = (target, candidates, limit = 3) => {
  const scored = candidates.map((candidate) => ({
    candidate,
    distance: levenshtein(target, candidate),
  }));
  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, limit);
};

const contentTypeToExtension = (contentType) => {
  if (!contentType) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "jpg";
};

const run = async () => {
  const mappings = await loadMappings();
  const aliases = await loadAliases();
  if (mappings.length === 0) {
    console.error("No mappings found with name + image_url.");
    process.exit(1);
  }

  const entrantsRes = await request(
    `${SUPABASE_URL}/rest/v1/entrants?select=id,name,promotion,roster_year&promotion=eq.${encodeURIComponent(
      PROMOTION
    )}&roster_year=eq.${ROSTER_YEAR}`,
    {
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  const entrants = await entrantsRes.json();

  const entrantByName = new Map();
  const entrantNames = [];
  entrants.forEach((entrant) => {
    const key = normalizeName(entrant.name);
    entrantByName.set(key, entrant);
    entrantNames.push(key);
  });

  let updated = 0;
  let missing = 0;
  let failed = 0;
  const missingNames = [];

  for (const { name, image_url } of mappings) {
    const normalized = normalizeName(name);
    const aliasTarget = aliases.get(normalized);
    const resolvedKey = aliasTarget ? normalizeName(aliasTarget) : normalized;
    let entrant = entrantByName.get(resolvedKey);
    if (!entrant && enableFuzzy) {
      const matches = getClosestMatches(resolvedKey, entrantNames, 1);
      if (matches[0] && matches[0].distance <= fuzzyMaxDistance) {
        entrant = entrantByName.get(matches[0].candidate);
      }
    }
    if (!entrant) {
      missing += 1;
      missingNames.push(name);
      const suggestions = getClosestMatches(resolvedKey, entrantNames, 3)
        .map((match) => match.candidate)
        .join(", ");
      console.warn(`Missing entrant: ${name}${suggestions ? ` (closest: ${suggestions})` : ""}`);
      continue;
    }

    try {
      const imageRes = await request(image_url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: image_url,
        },
      });
      const contentType = imageRes.headers.get("content-type");
      const extension = contentTypeToExtension(contentType);
      const fileName = `${ROSTER_YEAR}/${slugify(name)}.${extension}`;
      const buffer = new Uint8Array(await imageRes.arrayBuffer());

      await request(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${fileName}`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_SECRET_KEY,
            Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
            "Content-Type": contentType || "application/octet-stream",
            "x-upsert": "true",
          },
          body: buffer,
        }
      );

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${fileName}`;

      await request(`${SUPABASE_URL}/rest/v1/entrants?id=eq.${entrant.id}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image_url: publicUrl }),
      });

      updated += 1;
    } catch (err) {
      failed += 1;
      console.warn(`Failed for ${name}: ${err.message}`);
    }
  }

  console.log(
    `Uploaded ${updated} images. Missing: ${missing}. Failed: ${failed}.`
  );

  if (aliasTemplateOut && missingNames.length > 0) {
    const template = missingNames.map((item) => ({ from: item, to: "" }));
    await writeFile(aliasTemplateOut, JSON.stringify(template, null, 2), "utf-8");
    console.log(`Wrote alias template to ${aliasTemplateOut}.`);
  }
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
