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
    // ignore missing env file
  }
};

await loadEnvFile(resolve("scripts/.env"));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKETS = process.env.SUPABASE_STORAGE_BUCKETS;
const DEFAULT_BUCKETS = ["entrant-images", "promotion", "shows", "belts"];
const CACHE_CONTROL =
  process.env.SUPABASE_STORAGE_CACHE_CONTROL ||
  "public, max-age=31536000, immutable";
const DRY_RUN = process.env.DRY_RUN === "true";
const VERIFY_ONLY = process.env.VERIFY_ONLY === "true";
const SKIP_MATCHED = process.env.SKIP_MATCHED === "true";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Missing env vars: SUPABASE_URL, SUPABASE_SECRET_KEY");
  process.exit(1);
}

const request = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res;
};

const listBuckets = async () => {
  const res = await request("/storage/v1/bucket", { method: "GET" });
  return res.json();
};

const listObjects = async (bucket, prefix) => {
  const limit = 1000;
  let offset = 0;
  const items = [];
  while (true) {
    const res = await request(`/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit, offset }),
    });
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    items.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }
  return items;
};

const collectObjectPaths = async (bucket) => {
  const files = [];
  const prefixes = [""];
  while (prefixes.length > 0) {
    const prefix = prefixes.pop();
    const items = await listObjects(bucket, prefix);
    items.forEach((item) => {
      if (item.id) {
        files.push(`${prefix}${item.name}`);
      } else {
        prefixes.push(`${prefix}${item.name}/`);
      }
    });
  }
  return files;
};

const updateObjectCache = async (bucket, path) => {
  const res = await request(`/storage/v1/object/${bucket}/${path}`, {
    method: "GET",
  });
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const body = await res.arrayBuffer();
  await request(`/storage/v1/object/${bucket}/${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      "cache-control": CACHE_CONTROL,
      "x-upsert": "true",
    },
    body,
  });
};

const getObjectCacheControl = async (bucket, path) => {
  const res = await request(`/storage/v1/object/${bucket}/${path}`, {
    method: "HEAD",
  });
  return res.headers.get("cache-control");
};

const run = async () => {
  const bucketNames = BUCKETS
    ? BUCKETS.split(",").map((name) => name.trim()).filter(Boolean)
    : DEFAULT_BUCKETS;

  if (bucketNames.length === 0) {
    console.log("No buckets found.");
    return;
  }

  for (const bucket of bucketNames) {
    console.log(`Scanning bucket: ${bucket}`);
    const files = await collectObjectPaths(bucket);
    console.log(`Found ${files.length} objects in ${bucket}.`);
    let matched = 0;
    let mismatched = 0;
    let missing = 0;
    for (const path of files) {
      if (VERIFY_ONLY) {
        const header = await getObjectCacheControl(bucket, path);
        if (!header) {
          missing += 1;
          console.log(`[missing] ${bucket}/${path}`);
          continue;
        }
        if (header.includes(CACHE_CONTROL)) {
          matched += 1;
        } else {
          mismatched += 1;
          console.log(`[mismatch] ${bucket}/${path} -> ${header}`);
        }
        continue;
      }
      if (DRY_RUN) {
        console.log(`[dry-run] ${bucket}/${path}`);
        continue;
      }
      if (SKIP_MATCHED) {
        const header = await getObjectCacheControl(bucket, path);
        if (header && header.includes(CACHE_CONTROL)) {
          console.log(`[skip] ${bucket}/${path}`);
          continue;
        }
      }
      console.log(`Updating ${bucket}/${path}`);
      await updateObjectCache(bucket, path);
    }
    if (VERIFY_ONLY) {
      console.log(
        `Verify summary for ${bucket}: ${matched} ok, ${mismatched} mismatch, ${missing} missing`,
      );
    }
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
