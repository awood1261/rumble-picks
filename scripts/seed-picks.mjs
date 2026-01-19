const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const EVENT_ID = process.env.EVENT_ID;
const EMAIL_PREFIX = process.env.EMAIL_PREFIX ?? "rumbleuser";
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN ?? "test.com";
const START_INDEX = Number(process.env.START_INDEX ?? "1");
const USER_COUNT = Number(process.env.USER_COUNT ?? "0");

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

const headers = {
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
  const emailList = Array.from({ length: USER_COUNT }, (_, idx) => {
    const number = String(START_INDEX + idx).padStart(2, "0");
    return `${EMAIL_PREFIX}${number}@${EMAIL_DOMAIN}`;
  });

  const usersResponse = await request(
    `${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`,
    { headers }
  );
  const users = usersResponse?.users ?? [];
  const userIds = users
    .filter((user) => emailList.includes(user.email))
    .map((user) => user.id);
  if (userIds.length === 0) {
    throw new Error("No users found in profiles.");
  }

  const entrantRows = await request(
    `${SUPABASE_URL}/rest/v1/entrants?select=id&gender=eq.men&active=eq.true`,
    { headers }
  );
  const entrantIds = (entrantRows ?? []).map((row) => row.id);
  if (entrantIds.length === 0) {
    throw new Error("No male entrants found.");
  }

  for (const userId of userIds) {
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
      headers,
      body: JSON.stringify({
        user_id: userId,
        event_id: EVENT_ID,
        payload,
      }),
    });

    console.log(`Created picks for user: ${userId}`);
  }
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
