const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SHOW_ID =
  process.env.SHOW_ID ?? "6226e8db-3262-41c6-997c-00e98a184af8";
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN ?? "boutpick.test";
const RUN_TAG = process.env.RUN_TAG ?? null;
const DRY_RUN = process.env.DRY_RUN !== "false";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "Missing required env vars: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY"
  );
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
  "Content-Type": "application/json",
};

const request = async (url, options = {}) => {
  const res = await fetch(url, { headers, ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
};

const matchesSeedTag = (user) => {
  const metadata = user.user_metadata ?? {};
  if (metadata.test_seed !== true) {
    return false;
  }
  if (SHOW_ID && metadata.test_seed_show_id !== SHOW_ID) {
    return false;
  }
  if (RUN_TAG && metadata.test_seed_run_tag !== RUN_TAG) {
    return false;
  }
  return true;
};

const matchesLegacyPattern = (user) => {
  if (!user.email || !user.email.endsWith(`@${EMAIL_DOMAIN}`)) {
    return false;
  }
  if (RUN_TAG && !user.email.includes(`-${RUN_TAG}-`)) {
    return false;
  }
  return true;
};

const listUsers = async () => {
  const users = [];
  let page = 1;

  while (true) {
    const payload = await request(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=1000&page=${page}`
    );
    const batch = payload?.users ?? [];
    users.push(...batch);
    if (batch.length < 1000) {
      break;
    }
    page += 1;
  }

  return users;
};

const run = async () => {
  const users = await listUsers();
  const matches = users.filter(
    (user) => matchesSeedTag(user) || matchesLegacyPattern(user)
  );

  if (matches.length === 0) {
    console.log("No matching seeded test users found.");
    return;
  }

  console.log(
    `${DRY_RUN ? "[dry-run] " : ""}Found ${matches.length} matching seeded users`
  );
  matches.forEach((user) => {
    console.log(`- ${user.id} ${user.email}`);
  });

  if (DRY_RUN) {
    console.log(
      "Dry run only. Re-run with DRY_RUN=false to delete these users and cascade cleanup their profiles, picks, and scores."
    );
    return;
  }

  for (const user of matches) {
    await request(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
    });
    console.log(`Deleted ${user.email}`);
  }

  console.log(`Deleted ${matches.length} seeded test users.`);
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
