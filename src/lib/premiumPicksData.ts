import type {
  EntrantRow,
  MatchEntrantRow,
  MatchRow,
  MatchSideRow,
  PicksPayload,
  ShowRow,
} from "./picksTypes";
import { supabase } from "./supabaseClient";
import type { PremiumMapMatchNode } from "./premiumMapNodes";
import { PREMIUM_MAP_LAYOUT_ZONES } from "./premiumMapNodes";

const SHOW_SELECT =
  "id, name, tagline, image_url, promotion_id, starts_at, status, requires_email_registration, lock_picks_at_start, is_featured_play_show, is_over";
const MATCH_SELECT =
  "id, name, kind, match_type, status, order_index, is_main_event, is_championship, championship_name, championship_image_url, champion_side_id, winner_entrant_id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id, match_length, match_interference";
const ENTRANT_SELECT =
  "id, name, promotion, gender, image_url, logo_url, sprite_neutral_url, sprite_victory_url, sprite_defeat_url, roster_year, event_id, is_custom, created_by, status";

const EMPTY_PAYLOAD: PicksPayload = {
  rumbles: {},
  eliminators: {},
  question_picks: {},
  match_picks: {},
  match_finish_picks: {},
  match_length_picks: {},
  match_interference_picks: {},
};

export type PremiumMapData = {
  show: ShowRow | null;
  nodes: PremiumMapMatchNode[];
  payload: PicksPayload;
};

export type PremiumMatchSideData = {
  side: MatchSideRow;
  entrants: EntrantRow[];
  displayName: string;
};

export type PremiumMatchSceneData = {
  show: ShowRow;
  match: MatchRow;
  sides: PremiumMatchSideData[];
  payload: PicksPayload;
  selectedSideId: string | null;
};

const getDisplaySideName = (side: MatchSideRow, entrants: EntrantRow[]) => {
  const label = side.label?.trim();
  if (label) return label;
  if (entrants.length > 0) {
    return entrants.map((entrant) => entrant.name).join(" & ");
  }
  return "Unknown Side";
};

const loadExistingPayload = async (showId: string, userId: string | null) => {
  if (!userId) return EMPTY_PAYLOAD;

  const { data, error } = await supabase
    .from("picks")
    .select(
      "rumbles:payload->rumbles, eliminators:payload->eliminators, question_picks:payload->question_picks, match_picks:payload->match_picks, match_finish_picks:payload->match_finish_picks, match_length_picks:payload->match_length_picks, match_interference_picks:payload->match_interference_picks",
    )
    .eq("show_id", showId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return {
    rumbles: data?.rumbles ?? {},
    eliminators: data?.eliminators ?? {},
    question_picks: data?.question_picks ?? {},
    match_picks: data?.match_picks ?? {},
    match_finish_picks: data?.match_finish_picks ?? {},
    match_length_picks: data?.match_length_picks ?? {},
    match_interference_picks: data?.match_interference_picks ?? {},
  } as PicksPayload;
};

export const loadPremiumMapData = async (
  showId: string,
  userId: string | null,
): Promise<PremiumMapData> => {
  const [{ data: show, error: showError }, { data: matchRows, error: matchError }, payload] =
    await Promise.all([
      supabase.from("shows").select(SHOW_SELECT).eq("id", showId).maybeSingle(),
      supabase
        .from("matches")
        .select(MATCH_SELECT)
        .eq("show_id", showId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      loadExistingPayload(showId, userId),
    ]);

  if (showError) throw showError;
  if (matchError) throw matchError;

  const matchList = ((matchRows ?? []) as MatchRow[]).slice(
    0,
    PREMIUM_MAP_LAYOUT_ZONES.length,
  );

  const firstUnansweredMatchId =
    matchList.find((match) => !payload.match_picks?.[match.id])?.id ?? null;

  const nodes: PremiumMapMatchNode[] = matchList.map((match, index) => {
    const zone = PREMIUM_MAP_LAYOUT_ZONES[index];
    const hasPick = Boolean(payload.match_picks?.[match.id]);
    const status = hasPick
      ? "answered"
      : firstUnansweredMatchId === match.id
        ? "active"
        : "unanswered";

    return {
      id: `match-${match.id}`,
      matchId: match.id,
      title: match.name,
      type: "match",
      left: zone.left,
      top: zone.top,
      width: zone.width,
      height: zone.height,
      status,
    };
  });

  return {
    show: (show as ShowRow | null) ?? null,
    nodes,
    payload,
  };
};

export const loadPremiumMatchSceneData = async (
  showId: string,
  matchId: string,
  userId: string | null,
): Promise<PremiumMatchSceneData | null> => {
  const [{ data: show, error: showError }, { data: match, error: matchError }, payload] =
    await Promise.all([
      supabase.from("shows").select(SHOW_SELECT).eq("id", showId).maybeSingle(),
      supabase
        .from("matches")
        .select(MATCH_SELECT)
        .eq("show_id", showId)
        .eq("id", matchId)
        .maybeSingle(),
      loadExistingPayload(showId, userId),
    ]);

  if (showError) throw showError;
  if (matchError) throw matchError;
  if (!show || !match) return null;

  const [{ data: sideRows, error: sideError }, { data: entrantRows, error: entrantError }] =
    await Promise.all([
      supabase
        .from("match_sides")
        .select("id, match_id, label")
        .eq("match_id", matchId),
      supabase
        .from("match_entrants")
        .select("match_id, entrant_id, side_id")
        .eq("match_id", matchId),
    ]);

  if (sideError) throw sideError;
  if (entrantError) throw entrantError;

  const matchEntrants = (entrantRows ?? []) as MatchEntrantRow[];
  const entrantIds = [...new Set(matchEntrants.map((row) => row.entrant_id))];

  const { data: entrantsData, error: entrantsLoadError } = entrantIds.length
    ? await supabase
        .from("entrants")
        .select(ENTRANT_SELECT)
        .in("id", entrantIds)
    : { data: [], error: null };

  if (entrantsLoadError) throw entrantsLoadError;

  const entrantById = new Map(
    ((entrantsData ?? []) as EntrantRow[]).map((entrant) => [entrant.id, entrant]),
  );

  const sides = ((sideRows ?? []) as MatchSideRow[]).map((side) => {
    const sideEntrants = matchEntrants
      .filter((row) => row.side_id === side.id)
      .map((row) => entrantById.get(row.entrant_id))
      .filter((entrant): entrant is EntrantRow => Boolean(entrant));

    return {
      side,
      entrants: sideEntrants,
      displayName: getDisplaySideName(side, sideEntrants),
    };
  });

  return {
    show: show as ShowRow,
    match: match as MatchRow,
    sides,
    payload,
    selectedSideId: payload.match_picks?.[matchId] ?? null,
  };
};

export const savePremiumMatchPick = async (
  showId: string,
  userId: string,
  payload: PicksPayload,
) => {
  const { error } = await supabase.from("picks").upsert(
    {
      user_id: userId,
      show_id: showId,
      payload,
    },
    { onConflict: "user_id,show_id" },
  );

  if (error) throw error;
};
