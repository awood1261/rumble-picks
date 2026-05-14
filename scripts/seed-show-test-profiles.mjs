const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SHOW_ID =
  process.env.SHOW_ID ?? "6226e8db-3262-41c6-997c-00e98a184af8";
const USER_COUNT = Number(process.env.USER_COUNT ?? "12");
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN ?? "boutpick.test";
const RUN_TAG =
  process.env.RUN_TAG ??
  new Date().toISOString().slice(0, 10).replace(/-/g, "");
const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD ?? "password";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SHOW_ID) {
  console.error(
    "Missing required env vars: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SECRET_KEY, SHOW_ID"
  );
  process.exit(1);
}

if (!USER_COUNT || Number.isNaN(USER_COUNT) || USER_COUNT <= 0) {
  console.error("USER_COUNT must be a positive integer.");
  process.exit(1);
}

const authHeaders = {
  apikey: SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
  "Content-Type": "application/json",
};

const restHeaders = {
  ...authHeaders,
  Prefer: "return=representation,resolution=merge-duplicates",
};

const AVATAR_KEYS = [
  "default",
  "luchador-mask",
  "championship-belt",
  "ring-bell",
  "turnbuckle",
  "crown",
  "lightning",
  "skull",
  "bull",
  "wolf",
  "dragon",
  "microphone",
  "boot",
  "eagle",
  "flame",
];

const SPOOF_NAMES = [
  "The Undertyper",
  "Brock Laser",
  "Stone Cold Brewster",
  "John Scone",
  "Macho Spam Savage",
  "The Rock Lobster",
  "Randy Florton",
  "Hulk Hoagie",
  "Ric Flare Gun",
  "Seth Rollins Pin",
  "Bayley Corgan",
  "Becky Lynchnado",
];

const MATCH_LENGTH_OPTIONS = ["sprint", "standard", "epic"];
const FINISH_METHOD_OPTIONS = ["pinfall", "submission", "disqualification"];
const INTERFERENCE_OPTIONS = ["yes", "no"];
const TAG_MATCH_TYPES = new Set(["tag", "tag_3", "tag_4"]);
const MULTI_SIDE_MATCH_TYPES = new Set(["triple_threat", "fatal_4_way", "ladder_6"]);

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

const shuffle = (arr, random = Math.random) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const pickOne = (arr, random = Math.random) =>
  arr.length > 0 ? arr[Math.floor(random() * arr.length)] : null;

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const createSeededRandom = (seedValue) => {
  let seed = hashString(seedValue) || 1;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};

const createTestUsers = async (count) => {
  const createdUsers = [];

  for (let index = 0; index < count; index += 1) {
    const displayName = SPOOF_NAMES[index % SPOOF_NAMES.length];
    const avatarKey = AVATAR_KEYS[index % AVATAR_KEYS.length];
    const email = `${slugify(displayName)}-${RUN_TAG}-${String(index + 1).padStart(
      2,
      "0"
    )}@${EMAIL_DOMAIN}`;

    const user = await request(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        email,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          avatar_key: avatarKey,
          test_seed: true,
          test_seed_show_id: SHOW_ID,
          test_seed_run_tag: RUN_TAG,
        },
      }),
    });

    createdUsers.push({
      id: user.id,
      email,
      displayName,
      avatarKey,
    });
  }

  return createdUsers;
};

const buildMatchPayload = ({
  matches,
  matchSides,
  matchEntrants,
  useConfidencePoints,
  userIndex,
}) => {
  const matchPicks = {};
  const matchConfidencePicks = {};
  const matchFinishPicks = {};
  const matchLengthPicks = {};
  const matchInterferencePicks = {};
  const rankedMatchIds = matches.map((match) => match.id);
  const seededRandom = createSeededRandom(`${SHOW_ID}:${userIndex}`);
  const confidenceRanks = useConfidencePoints
    ? shuffle(
        Array.from({ length: rankedMatchIds.length }, (_, idx) => idx + 1),
        seededRandom
      )
    : [];

  matches.forEach((match, matchIndex) => {
    const sidesForMatch = matchSides.filter((side) => side.match_id === match.id);
    const entrantsForMatch = matchEntrants.filter(
      (entry) => entry.match_id === match.id
    );
    const sidesWithEntrants = sidesForMatch.filter((side) =>
      entrantsForMatch.some((entry) => entry.side_id === side.id)
    );

    const selectedSide =
      sidesWithEntrants.length > 0
        ? sidesWithEntrants[(userIndex + matchIndex) % sidesWithEntrants.length]
        : null;

    matchPicks[match.id] = selectedSide?.id ?? null;

    if (useConfidencePoints) {
      matchConfidencePicks[match.id] = confidenceRanks[matchIndex] ?? null;
    }

    const method = pickOne(FINISH_METHOD_OPTIONS, seededRandom);
    matchLengthPicks[match.id] = pickOne(MATCH_LENGTH_OPTIONS, seededRandom);
    matchInterferencePicks[match.id] = pickOne(INTERFERENCE_OPTIONS, seededRandom);

    let finishWinner = null;
    let finishLoser = null;
    const finishRequiresEntrants =
      method === "pinfall" || method === "submission";

    if (
      finishRequiresEntrants &&
      TAG_MATCH_TYPES.has(match.match_type) &&
      selectedSide
    ) {
      const winners = entrantsForMatch
        .filter((entry) => entry.side_id === selectedSide.id)
        .map((entry) => entry.entrant_id);
      const losers = entrantsForMatch
        .filter((entry) => entry.side_id !== selectedSide.id)
        .map((entry) => entry.entrant_id);
      finishWinner = pickOne(winners, seededRandom);
      finishLoser = pickOne(losers, seededRandom);
    } else if (
      finishRequiresEntrants &&
      !MULTI_SIDE_MATCH_TYPES.has(match.match_type) &&
      !TAG_MATCH_TYPES.has(match.match_type)
    ) {
      const entrantIds = shuffle(
        entrantsForMatch.map((entry) => entry.entrant_id),
        seededRandom
      );
      finishWinner = entrantIds[0] ?? null;
      finishLoser = entrantIds[1] ?? null;
    }

    matchFinishPicks[match.id] = {
      method,
      winner: finishWinner,
      loser: finishLoser,
    };
  });

  return {
    match_picks: matchPicks,
    match_confidence_picks: matchConfidencePicks,
    match_finish_picks: matchFinishPicks,
    match_length_picks: matchLengthPicks,
    match_interference_picks: matchInterferencePicks,
  };
};

const run = async () => {
  const showRows = await request(
    `${SUPABASE_URL}/rest/v1/shows?id=eq.${SHOW_ID}&select=id,name,use_confidence_points`,
    { headers: restHeaders }
  );
  const show = showRows?.[0];

  if (!show) {
    throw new Error(`Show not found for id ${SHOW_ID}`);
  }

  const matchRows = await request(
    `${SUPABASE_URL}/rest/v1/matches?show_id=eq.${SHOW_ID}&select=id,name,match_type,order_index&order=order_index.asc.nullslast,name.asc`,
    { headers: restHeaders }
  );
  const matches = matchRows ?? [];

  if (matches.length === 0) {
    throw new Error("No matches found for the target show.");
  }

  const matchIds = matches.map((match) => match.id);
  const [matchSides, matchEntrants] = await Promise.all([
    request(
      `${SUPABASE_URL}/rest/v1/match_sides?select=id,match_id,label&match_id=in.(${matchIds.join(
        ","
      )})`,
      { headers: restHeaders }
    ),
    request(
      `${SUPABASE_URL}/rest/v1/match_entrants?select=match_id,entrant_id,side_id&match_id=in.(${matchIds.join(
        ","
      )})`,
      { headers: restHeaders }
    ),
  ]);

  const createdUsers = await createTestUsers(USER_COUNT);

  for (let index = 0; index < createdUsers.length; index += 1) {
    const user = createdUsers[index];
    const payload = {
      rumbles: {},
      eliminators: {},
      question_picks: {},
      ...buildMatchPayload({
        matches,
        matchSides: matchSides ?? [],
        matchEntrants: matchEntrants ?? [],
        useConfidencePoints: show.use_confidence_points ?? false,
        userIndex: index,
      }),
    };

    await request(`${SUPABASE_URL}/rest/v1/picks?on_conflict=user_id,show_id`, {
      method: "POST",
      headers: restHeaders,
      body: JSON.stringify({
        user_id: user.id,
        show_id: SHOW_ID,
        payload,
      }),
    });

    console.log(
      `Seeded ${user.displayName} (${user.email}) for show ${show.name}`
    );
  }

  console.log(
    `Created ${createdUsers.length} test profiles and picks for show ${show.name} (${SHOW_ID}).`
  );
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
