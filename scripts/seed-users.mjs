const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const EVENT_ID = process.env.EVENT_ID;
const USER_COUNT = Number(process.env.USER_COUNT ?? "0");
const START_INDEX = Number(process.env.START_INDEX ?? "1");
const EMAIL_PREFIX = process.env.EMAIL_PREFIX ?? "rumbleuser";
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN ?? "test.com";
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD ?? "password";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !EVENT_ID) {
  console.error(
    "Missing required env vars: SUPABASE_URL, SUPABASE_SECRET_KEY, EVENT_ID"
  );
  process.exit(1);
}

if (!USER_COUNT || Number.isNaN(USER_COUNT)) {
  console.error("Set USER_COUNT to a positive number.");
  process.exit(1);
}

if (!START_INDEX || Number.isNaN(START_INDEX)) {
  console.error("Set START_INDEX to a positive number.");
  process.exit(1);
}

const authHeaders = {
  apikey: SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
  "Content-Type": "application/json",
};

const restHeaders = {
  apikey: SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

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

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const pickMany = (arr, count) => shuffle(arr).slice(0, count);

const run = async () => {
  const rumbleEntriesUrl = `${SUPABASE_URL}/rest/v1/rumble_entries?event_id=eq.${EVENT_ID}&select=entrant_id`;
  const rumbleEntries = await request(rumbleEntriesUrl, {
    headers: restHeaders,
  });

  const entrantIds = [...new Set(rumbleEntries.map((row) => row.entrant_id))];
  if (entrantIds.length === 0) {
    throw new Error("No rumble_entries found for this event.");
  }

  for (let i = START_INDEX; i < START_INDEX + USER_COUNT; i += 1) {
    const email = `${EMAIL_PREFIX}${String(i).padStart(2, "0")}@${EMAIL_DOMAIN}`;
    const user = await request(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      }),
    });

    const entrants = pickMany(entrantIds, Math.min(30, entrantIds.length));
    const finalFour = pickMany(entrants, Math.min(4, entrants.length));
    const winner = pickMany(entrants, 1)[0] ?? null;
    const entry1 = pickMany(entrants, 1)[0] ?? null;
    const entry2 = pickMany(entrants, 1)[0] ?? null;
    const entry30 = pickMany(entrants, 1)[0] ?? null;
    const mostElims = pickMany(entrants, 1)[0] ?? null;

    const payload = {
      entrants,
      final_four: finalFour,
      winner,
      entry_1: entry1,
      entry_2: entry2,
      entry_30: entry30,
      most_eliminations: mostElims,
    };

    await request(`${SUPABASE_URL}/rest/v1/picks`, {
      method: "POST",
      headers: restHeaders,
      body: JSON.stringify({
        user_id: user.id,
        event_id: EVENT_ID,
        payload,
      }),
    });

    console.log(`Created user + picks: ${email}`);
  }
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
