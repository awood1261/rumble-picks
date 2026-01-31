const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SHOW_ID = process.env.SHOW_ID;
const EMAIL_PREFIX = process.env.EMAIL_PREFIX ?? "rumbleuser";
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN ?? "test.com";
const START_INDEX = Number(process.env.START_INDEX ?? "1");
const USER_COUNT = Number(process.env.USER_COUNT ?? "0");

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SHOW_ID) {
  console.error(
    "Missing required env vars: SUPABASE_URL, SUPABASE_SECRET_KEY, SHOW_ID"
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
  Prefer: "return=representation,resolution=merge-duplicates",
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

  const showRows = await request(
    `${SUPABASE_URL}/rest/v1/shows?id=eq.${SHOW_ID}&select=id,name`,
    { headers }
  );
  const showRow = showRows?.[0];
  if (!showRow) {
    throw new Error(`Show not found for id ${SHOW_ID}`);
  }

  const showEvents = await request(
    `${SUPABASE_URL}/rest/v1/events?show_id=eq.${SHOW_ID}&select=id,rumble_gender,roster_year`,
    { headers }
  );

  const showMatches = await request(
    `${SUPABASE_URL}/rest/v1/matches?show_id=eq.${SHOW_ID}&select=id,match_type`,
    { headers }
  );
  const matchIds = (showMatches ?? []).map((match) => match.id);
  let matchSides = [];
  let matchEntrants = [];
  if (matchIds.length > 0) {
    const [matchSideRows, matchEntrantRows] = await Promise.all([
      request(
        `${SUPABASE_URL}/rest/v1/match_sides?select=id,match_id,label&match_id=in.(${matchIds.join(
          ","
        )})`,
        { headers }
      ),
      request(
        `${SUPABASE_URL}/rest/v1/match_entrants?select=match_id,entrant_id,side_id&match_id=in.(${matchIds.join(
          ","
        )})`,
        { headers }
      ),
    ]);
    matchSides = matchSideRows ?? [];
    matchEntrants = matchEntrantRows ?? [];
  }

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

  const eventEntrantMap = new Map();
  for (const event of showEvents ?? []) {
    const gender = event.rumble_gender ?? "men";
    const rosterYear = event.roster_year;
    const yearFilter =
      rosterYear === null || rosterYear === undefined
        ? "roster_year=is.null"
        : `roster_year=eq.${rosterYear}`;
    const entrantRows = await request(
      `${SUPABASE_URL}/rest/v1/entrants?select=id&gender=eq.${gender}&active=eq.true&${yearFilter}&or=(event_id.is.null,event_id.eq.${event.id})`,
      { headers }
    );
    const entrantIds = (entrantRows ?? []).map((row) => row.id);
    eventEntrantMap.set(event.id, entrantIds);
  }

  for (const userId of userIds) {
    const rumbles = {};
    for (const event of showEvents ?? []) {
      const entrantIds = eventEntrantMap.get(event.id) ?? [];
      const entrants = pickMany(entrantIds, Math.min(30, entrantIds.length));
      const finalFour = pickMany(entrants, Math.min(4, entrants.length));
      const winner = pickMany(entrants, 1)[0] ?? null;
      const entry1 = pickMany(entrants, 1)[0] ?? null;
      const entry2 = pickMany(entrants, 1)[0] ?? null;
      const entry30 = pickMany(entrants, 1)[0] ?? null;
      const mostElims = pickMany(entrants, 1)[0] ?? null;
      rumbles[event.id] = {
        entrants,
        final_four: finalFour,
        winner,
        entry_1: entry1,
        entry_2: entry2,
        entry_30: entry30,
        most_eliminations: mostElims,
      };
    }

    const matchPicks = {};
    const matchFinishPicks = {};
    const finishMethods = ["pinfall", "submission", "disqualification"];
    for (const match of showMatches ?? []) {
      const sides = matchSides.filter((side) => side.match_id === match.id);
      const entrantsForMatch = matchEntrants.filter(
        (row) => row.match_id === match.id
      );
      const sidesWithEntrants = sides.filter((side) =>
        entrantsForMatch.some((row) => row.side_id === side.id)
      );
      const winningSide =
        sidesWithEntrants.length > 0
          ? pickMany(sidesWithEntrants, 1)[0]
          : null;
      matchPicks[match.id] = winningSide?.id ?? null;

      const method = pickMany(finishMethods, 1)[0] ?? null;
      const isTag = match.match_type === "tag";
      const isSingles = match.match_type === "singles";
      const isTripleOrFatal =
        match.match_type === "triple_threat" ||
        match.match_type === "fatal_4_way";

      let finishWinner = null;
      let finishLoser = null;
      if (method === "pinfall" || method === "submission") {
        if (isTag && winningSide) {
          const winners = entrantsForMatch
            .filter((row) => row.side_id === winningSide.id)
            .map((row) => row.entrant_id);
          const losers = entrantsForMatch
            .filter((row) => row.side_id !== winningSide.id)
            .map((row) => row.entrant_id);
          finishWinner = pickMany(winners, 1)[0] ?? null;
          finishLoser = pickMany(losers, 1)[0] ?? null;
        } else {
          const allEntrantIds = entrantsForMatch
            .map((row) => row.entrant_id)
            .filter(Boolean);
          const shuffled = shuffle(allEntrantIds);
          finishWinner = shuffled[0] ?? null;
          finishLoser = shuffled[1] ?? null;
        }
      }

      matchFinishPicks[match.id] = {
        method,
        winner: finishWinner,
        loser: finishLoser,
      };
    }

    const payload = {
      rumbles,
      match_picks: matchPicks,
      match_finish_picks: matchFinishPicks,
    };

    await request(`${SUPABASE_URL}/rest/v1/picks?on_conflict=user_id,show_id`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: userId,
        show_id: SHOW_ID,
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
