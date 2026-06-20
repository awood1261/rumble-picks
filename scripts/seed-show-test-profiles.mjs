import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SHOW_ID =
  process.env.SHOW_ID ?? "6226e8db-3262-41c6-997c-00e98a184af8";
const USER_COUNT = Number(process.env.USER_COUNT ?? "12");
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN ?? "boutpick.test";
const AUTH_MODE = process.env.AUTH_MODE ?? "anonymous";
const USER_CREATE_DELAY_MS = Number(process.env.USER_CREATE_DELAY_MS ?? "1250");
const USER_CREATE_MAX_RETRIES = Number(process.env.USER_CREATE_MAX_RETRIES ?? "5");
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

if (AUTH_MODE === "anonymous" && !SUPABASE_PUBLISHABLE_KEY) {
  console.error(
    "Missing required env var for anonymous users: SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"
  );
  process.exit(1);
}

if (!USER_COUNT || Number.isNaN(USER_COUNT) || USER_COUNT <= 0) {
  console.error("USER_COUNT must be a positive integer.");
  process.exit(1);
}

if (
  Number.isNaN(USER_CREATE_DELAY_MS) ||
  USER_CREATE_DELAY_MS < 0 ||
  Number.isNaN(USER_CREATE_MAX_RETRIES) ||
  USER_CREATE_MAX_RETRIES < 0
) {
  console.error("USER_CREATE_DELAY_MS and USER_CREATE_MAX_RETRIES must be positive numbers.");
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

const createAnonymousClient = () =>
  createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

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
const BLIND_GAUNTLET_MATCH_TYPE = "blind_gauntlet";

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const findUserByEmail = async (email) => {
  let page = 1;

  while (true) {
    const payload = await request(
      `${SUPABASE_URL}/auth/v1/admin/users?per_page=1000&page=${page}`,
      { headers: authHeaders }
    );
    const users = payload?.users ?? [];
    const user = users.find((item) => item.email === email);
    if (user) return user;
    if (users.length < 1000) return null;
    page += 1;
  }
};

const createAnonymousTestUser = async ({ displayName, avatarKey, index }) => {
  const username = `${displayName} ${RUN_TAG} ${String(index + 1).padStart(2, "0")}`;
  let lastError = null;

  for (let attempt = 0; attempt <= USER_CREATE_MAX_RETRIES; attempt += 1) {
    const supabase = createAnonymousClient();
    const { data, error } = await supabase.auth.signInAnonymously({
      options: {
        data: {
          display_name: username,
          avatar_key: avatarKey,
          marketing_opt_in: false,
          test_seed: true,
          test_seed_show_id: SHOW_ID,
          test_seed_run_tag: RUN_TAG,
        },
      },
    });

    if (!error && data.user) {
      await supabase.auth.signOut();

      return {
        id: data.user.id,
        email: null,
        displayName: username,
        avatarKey,
      };
    }

    await supabase.auth.signOut();
    lastError = error;
    const message = error?.message ?? "";
    const isRateLimited = message.toLowerCase().includes("rate limit");
    if (!isRateLimited || attempt === USER_CREATE_MAX_RETRIES) {
      break;
    }

    const waitMs = USER_CREATE_DELAY_MS * (attempt + 2);
    console.log(
      `Rate limited creating ${username}. Retrying in ${Math.round(waitMs / 1000)}s...`
    );
    await sleep(waitMs);
  }

  throw new Error(lastError?.message ?? "Failed to create anonymous test user.");
};

const createEmailTestUser = async ({ displayName, avatarKey, index }) => {
  const email = `${slugify(displayName)}-${RUN_TAG}-${String(index + 1).padStart(
    2,
    "0"
  )}@${EMAIL_DOMAIN}`;
  let user;

  try {
    user = await request(`${SUPABASE_URL}/auth/v1/admin/users`, {
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
  } catch (error) {
    if (!String(error?.message ?? "").includes("email_exists")) {
      throw error;
    }
    user = await findUserByEmail(email);
    if (!user) {
      throw error;
    }
    console.log(`Reusing existing test user: ${email}`);
  }

  return {
    id: user.id,
    email,
    displayName,
    avatarKey,
  };
};

const createTestUsers = async (count) => {
  const createdUsers = [];

  for (let index = 0; index < count; index += 1) {
    const displayName = SPOOF_NAMES[index % SPOOF_NAMES.length];
    const avatarKey = AVATAR_KEYS[index % AVATAR_KEYS.length];
    const user =
      AUTH_MODE === "email"
        ? await createEmailTestUser({ displayName, avatarKey, index })
        : await createAnonymousTestUser({ displayName, avatarKey, index });

    createdUsers.push(user);
    if (AUTH_MODE === "anonymous" && USER_CREATE_DELAY_MS > 0 && index < count - 1) {
      await sleep(USER_CREATE_DELAY_MS);
    }
  }

  return createdUsers;
};

const buildMatchPayload = ({
  matches,
  matchSides,
  matchEntrants,
  gauntletCandidates,
  useConfidencePoints,
  userIndex,
}) => {
  const matchPicks = {};
  const matchConfidencePicks = {};
  const matchFinishPicks = {};
  const matchLengthPicks = {};
  const matchInterferencePicks = {};
  const blindGauntletPicks = {};
  const rankedMatchIds = matches
    .filter((match) => match.match_type !== BLIND_GAUNTLET_MATCH_TYPE)
    .map((match) => match.id);
  const seededRandom = createSeededRandom(`${SHOW_ID}:${userIndex}`);
  const confidenceRanks = useConfidencePoints
    ? shuffle(
        Array.from({ length: rankedMatchIds.length }, (_, idx) => idx + 1),
        seededRandom
      )
    : [];
  const confidenceRankByMatchId = new Map(
    rankedMatchIds.map((matchId, index) => [matchId, confidenceRanks[index] ?? null])
  );

  matches.forEach((match, matchIndex) => {
    matchLengthPicks[match.id] = pickOne(MATCH_LENGTH_OPTIONS, seededRandom);

    if (match.match_type === BLIND_GAUNTLET_MATCH_TYPE) {
      const candidateIds = gauntletCandidates
        .filter((row) => row.match_id === match.id)
        .map((row) => row.entrant_id);
      const shuffledCandidateIds = shuffle(candidateIds, seededRandom);
      const maxSelected = Math.min(shuffledCandidateIds.length, 5);
      const selectedCount =
        maxSelected > 0 ? 1 + Math.floor(seededRandom() * maxSelected) : 0;
      const entrantIds = shuffledCandidateIds.slice(0, selectedCount);

      blindGauntletPicks[match.id] = {
        survival: seededRandom() >= 0.5,
        entrant_ids: entrantIds,
        final_entrant_id: pickOne(entrantIds, seededRandom),
      };
      return;
    }

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
      matchConfidencePicks[match.id] = confidenceRankByMatchId.get(match.id) ?? null;
    }

    const method = pickOne(FINISH_METHOD_OPTIONS, seededRandom);
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
    blind_gauntlet_picks: blindGauntletPicks,
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
  const [matchSides, matchEntrants, gauntletCandidates] = await Promise.all([
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
    request(
      `${SUPABASE_URL}/rest/v1/gauntlet_candidate_entrants?select=match_id,entrant_id&match_id=in.(${matchIds.join(
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
        gauntletCandidates: gauntletCandidates ?? [],
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
      `Seeded ${user.displayName}${user.email ? ` (${user.email})` : ""} for show ${show.name}`
    );
  }

  console.log(
    `Created ${createdUsers.length} ${AUTH_MODE} test profiles and picks for show ${show.name} (${SHOW_ID}).`
  );
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
