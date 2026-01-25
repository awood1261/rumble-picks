import { readFile } from "node:fs/promises";
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

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing env vars: SUPABASE_URL, SUPABASE_SECRET_KEY");
  process.exit(1);
}

const inputFiles = process.argv.slice(2);
if (inputFiles.length === 0) {
  console.error("Provide one or more JSON files with name/image_url pairs.");
  process.exit(1);
}

const request = async (url, options) => {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
};

const normalizeName = (value) => value.trim().toLowerCase();

const loadMappings = async () => {
  const mappings = [];
  for (const file of inputFiles) {
    const raw = await readFile(file, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      throw new Error(`Expected array in ${file}`);
    }
    data.forEach((item) => {
      if (typeof item === "string") {
        mappings.push({ name: item, image_url: null });
        return;
      }
      if (item && typeof item === "object") {
        mappings.push({
          name: item.name ?? item.title ?? "",
          image_url: item.image_url ?? item.imageUrl ?? item.image ?? null,
        });
      }
    });
  }
  return mappings.filter((item) => item.name && item.image_url);
};

const run = async () => {
  const mappings = await loadMappings();
  if (mappings.length === 0) {
    console.error("No mappings found with name + image_url.");
    process.exit(1);
  }

  const entrants = await request(
    `${SUPABASE_URL}/rest/v1/entrants?select=id,name,promotion`,
    {
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const entrantByName = new Map();
  entrants.forEach((entrant) => {
    const key = normalizeName(entrant.name);
    const current = entrantByName.get(key);
    if (!current) {
      entrantByName.set(key, entrant);
      return;
    }
    const currentIsWwe =
      (current.promotion ?? "").trim().toLowerCase() === "wwe";
    const nextIsWwe =
      (entrant.promotion ?? "").trim().toLowerCase() === "wwe";
    if (!currentIsWwe && nextIsWwe) {
      entrantByName.set(key, entrant);
    }
  });

  let updated = 0;
  let missing = 0;
  for (const { name, image_url } of mappings) {
    const entrant = entrantByName.get(normalizeName(name));
    if (!entrant) {
      missing += 1;
      console.warn(`Missing entrant: ${name}`);
      continue;
    }
    await request(
      `${SUPABASE_URL}/rest/v1/entrants?id=eq.${entrant.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image_url }),
      }
    );
    updated += 1;
  }

  console.log(`Updated ${updated} entrants. Missing: ${missing}.`);
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
