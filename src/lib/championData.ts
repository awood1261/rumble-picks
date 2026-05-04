import "server-only";

import {
  calculateScore,
  type RumbleEntryRow as ScoringRumbleEntryRow,
  type EliminatorEliminationRow,
  type EliminatorEntryRow,
  type EliminatorRow,
  type MatchEntrantRow,
  type MatchRow,
  type MatchSideRow,
  type PicksPayload,
  type ShowQuestionRow,
} from "./scoring";
import { scoringRules } from "./scoringRules";
import { supabaseAdmin } from "./supabaseAdmin";
import type {
  ChampionCardCodeRow,
  ChampionClaimRow,
  ChampionClaimType,
  ChampionCompletedShow,
  ChampionParticipant,
  ChampionProfileClaim,
  ChampionPromotion,
} from "./championTypes";

type ShowRow = {
  id: string;
  name: string;
  starts_at: string | null;
  promotion_id: string | null;
  is_over?: boolean | null;
};

type PickRow = {
  user_id: string;
  show_id?: string | null;
  payload: PicksPayload | null;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_key: string | null;
};

type PromotionRow = ChampionPromotion;

type EventRow = {
  id: string;
  show_id: string | null;
  iron_person_entrant_id: string | null;
};

type RumbleEntryDbRow = ScoringRumbleEntryRow & {
  event_id: string;
};

type ScoredWinner = {
  user_id: string;
  points: number;
  updated_at: string;
};

const withoutShowId = <T extends { show_id: string | null }>(row: T): Omit<T, "show_id"> => {
  const { show_id, ...rest } = row;
  void show_id;
  return rest;
};

const withoutEventId = <T extends { event_id: string }>(row: T): Omit<T, "event_id"> => {
  const { event_id, ...rest } = row;
  void event_id;
  return rest;
};

export const validateChampionCode = async (
  promotionId: string,
  code: string
): Promise<ChampionCardCodeRow | null> => {
  const trimmed = code.trim();
  if (!promotionId || !trimmed) return null;

  const { data, error } = await supabaseAdmin
    .from("champion_card_codes")
    .select("id, promotion_id, code, active, created_at")
    .eq("promotion_id", promotionId)
    .eq("code", trimmed)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ChampionCardCodeRow | null) ?? null;
};

export const getChampionPromotion = async (
  promotionId: string
): Promise<ChampionPromotion | null> => {
  if (!promotionId) return null;

  const { data, error } = await supabaseAdmin
    .from("promotions")
    .select("id, name, image_url")
    .eq("id", promotionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as PromotionRow | null) ?? null;
};

export const getCompletedShowsForPromotion = async (
  promotionId: string
): Promise<ChampionCompletedShow[]> => {
  const { data, error } = await supabaseAdmin
    .from("shows")
    .select("id, name, starts_at, promotion_id, is_over")
    .eq("promotion_id", promotionId)
    .eq("is_over", true)
    .order("starts_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  const shows = ((data ?? []) as ShowRow[]).filter((show) => show.is_over);
  return shows.map((show) => ({
    id: show.id,
    name: show.name,
    starts_at: show.starts_at,
    promotion_id: show.promotion_id,
    winner_user_id: null,
    winner_username: null,
    winner_avatar: null,
  }));
};

export const getChampionWinnerForShow = async (
  promotionId: string,
  showId: string
): Promise<ChampionCompletedShow | null> => {
  const { data, error } = await supabaseAdmin
    .from("shows")
    .select("id, name, starts_at, promotion_id, is_over")
    .eq("id", showId)
    .eq("promotion_id", promotionId)
    .eq("is_over", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const show = (data as ShowRow | null) ?? null;
  if (!show || !show.is_over) return null;

  const { data: eventData, error: eventError } = await supabaseAdmin
    .from("events")
    .select("id, show_id, iron_person_entrant_id")
    .eq("show_id", show.id);

  if (eventError) {
    throw new Error(eventError.message);
  }

  const events = (eventData ?? []) as EventRow[];
  const eventIds = events.map((event) => event.id);

  const [
    { data: pickData, error: pickError },
    { data: rumbleEntryData, error: rumbleEntryError },
    { data: matchData, error: matchError },
    { data: eliminatorData, error: eliminatorError },
    { data: questionData, error: questionError },
  ] = await Promise.all([
    supabaseAdmin
      .from("picks")
      .select("user_id, show_id, payload, updated_at")
      .eq("show_id", show.id),
    eventIds.length > 0
      ? supabaseAdmin
          .from("rumble_entries")
          .select(
            "event_id, entrant_id, entry_number, eliminated_at, eliminations_count, is_confirmed"
          )
          .in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin
      .from("matches")
      .select(
        "id, show_id, winner_entrant_id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id, match_length, match_interference"
      )
      .eq("show_id", show.id),
    supabaseAdmin
      .from("eliminators")
      .select("id, show_id, winner_entrant_id")
      .eq("show_id", show.id),
    supabaseAdmin
      .from("show_questions")
      .select("id, show_id, correct_answer")
      .eq("show_id", show.id),
  ]);

  if (pickError) throw new Error(pickError.message);
  if (rumbleEntryError) throw new Error(rumbleEntryError.message);
  if (matchError) throw new Error(matchError.message);
  if (eliminatorError) throw new Error(eliminatorError.message);
  if (questionError) throw new Error(questionError.message);

  const picks = (pickData ?? []) as PickRow[];
  const rumbleEntries = (rumbleEntryData ?? []) as RumbleEntryDbRow[];
  const matchesByShow = (matchData ?? []) as (MatchRow & { show_id: string | null })[];
  const eliminatorsByShow = (eliminatorData ?? []) as (EliminatorRow & {
    show_id: string | null;
  })[];
  const questionsByShow = (questionData ?? []) as (ShowQuestionRow & {
    show_id: string | null;
  })[];

  const matchIds = matchesByShow.map((match) => match.id);
  const eliminatorIds = eliminatorsByShow.map((eliminator) => eliminator.id);

  const [
    { data: matchSideData, error: matchSideError },
    { data: matchEntrantData, error: matchEntrantError },
    { data: eliminatorEntryData, error: eliminatorEntryError },
    { data: eliminatorEliminationData, error: eliminatorEliminationError },
  ] = await Promise.all([
    matchIds.length > 0
      ? supabaseAdmin
          .from("match_sides")
          .select("id, match_id, label")
          .in("match_id", matchIds)
      : Promise.resolve({ data: [], error: null }),
    matchIds.length > 0
      ? supabaseAdmin
          .from("match_entrants")
          .select("match_id, entrant_id, side_id")
          .in("match_id", matchIds)
      : Promise.resolve({ data: [], error: null }),
    eliminatorIds.length > 0
      ? supabaseAdmin
          .from("eliminator_entries")
          .select("eliminator_id, entrant_id, entry_order")
          .in("eliminator_id", eliminatorIds)
      : Promise.resolve({ data: [], error: null }),
    eliminatorIds.length > 0
      ? supabaseAdmin
          .from("eliminator_eliminations")
          .select(
            "eliminator_id, eliminated_entrant_id, eliminated_by_entrant_id, elimination_type, elimination_order"
          )
          .in("eliminator_id", eliminatorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (matchSideError) throw new Error(matchSideError.message);
  if (matchEntrantError) throw new Error(matchEntrantError.message);
  if (eliminatorEntryError) throw new Error(eliminatorEntryError.message);
  if (eliminatorEliminationError) {
    throw new Error(eliminatorEliminationError.message);
  }

  const matchSides = (matchSideData ?? []) as MatchSideRow[];
  const matchEntrants = (matchEntrantData ?? []) as MatchEntrantRow[];
  const eliminatorEntries = (eliminatorEntryData ?? []) as EliminatorEntryRow[];
  const eliminatorEliminations = (eliminatorEliminationData ?? []) as EliminatorEliminationRow[];

  const showEventIds = events.map((event) => event.id);
  const showIronPersonId = events[0]?.iron_person_entrant_id ?? null;
  const showPicks = picks.filter((pick) => pick.show_id === show.id);
  const showMatches = matchesByShow.map(withoutShowId);
  const showMatchIds = new Set(showMatches.map((match) => match.id));
  const showEliminators = eliminatorsByShow.map(withoutShowId);
  const showEliminatorIds = new Set(showEliminators.map((eliminator) => eliminator.id));
  const showQuestions = questionsByShow.map(withoutShowId);

  let best: ScoredWinner | null = null;
  for (const pick of showPicks) {
    const payload = (pick.payload ?? {}) as PicksPayload;
    const { points } = calculateScore(
      payload,
      rumbleEntries
        .filter((entry) => showEventIds.includes(entry.event_id))
        .map(withoutEventId),
      scoringRules,
      showMatches,
      matchEntrants.filter((entry) => showMatchIds.has(entry.match_id)),
      matchSides.filter((side) => showMatchIds.has(side.match_id)),
      { ironPersonId: showIronPersonId },
      eliminatorEntries.filter((entry) => showEliminatorIds.has(entry.eliminator_id)),
      eliminatorEliminations.filter((entry) =>
        showEliminatorIds.has(entry.eliminator_id)
      ),
      showEliminators,
      showQuestions
    );

    if (
      !best ||
      points > best.points ||
      (points === best.points && pick.updated_at < best.updated_at)
    ) {
      best = {
        user_id: pick.user_id,
        points,
        updated_at: pick.updated_at,
      };
    }
  }

  const winnerIds = best?.user_id ? [best.user_id] : [];

  let profileMap = new Map<string, ProfileRow>();
  if (winnerIds.length > 0) {
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_key")
      .in("id", winnerIds);

    if (profileError) {
      throw new Error(profileError.message);
    }

    profileMap = new Map(
      ((profileData ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
    );
  }

  const profile = best ? profileMap.get(best.user_id) ?? null : null;
  const winnerUsername = profile?.display_name?.trim() || (best ? "Anonymous" : null);

  return {
    id: show.id,
    name: show.name,
    starts_at: show.starts_at,
    promotion_id: show.promotion_id,
    winner_user_id: best?.user_id ?? null,
    winner_username: winnerUsername,
    winner_avatar: profile?.avatar_key ?? null,
  };
};

export const createChampionClaim = async ({
  promotionId,
  sourceCodeId,
  claimType,
  showId,
  claimedUsername,
  claimedAvatar,
  claimedByUserId,
  claimedByGuestId,
}: {
  promotionId: string;
  sourceCodeId: string;
  claimType: ChampionClaimType;
  showId: string | null;
  claimedUsername: string;
  claimedAvatar: string | null;
  claimedByUserId: string | null;
  claimedByGuestId: string | null;
}): Promise<ChampionClaimRow> => {
  const trimmedUsername = claimedUsername.trim();
  if (!trimmedUsername) {
    throw new Error("A champion username is required.");
  }
  if (!claimedByUserId && !claimedByGuestId) {
    throw new Error("A signed-in or guest identity is required.");
  }

  const { data, error } = await supabaseAdmin
    .from("champion_claims")
    .insert({
      promotion_id: promotionId,
      show_id: showId,
      claim_type: claimType,
      claimed_username: trimmedUsername,
      claimed_avatar: claimedAvatar,
      source_code_id: sourceCodeId,
      claimed_by_user_id: claimedByUserId,
      claimed_by_guest_id: claimedByGuestId,
    })
    .select(
      "id, promotion_id, show_id, claim_type, claimed_username, claimed_avatar, source_code_id, claimed_by_user_id, claimed_by_guest_id, created_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ChampionClaimRow;
};

export const getChampionParticipantsForShow = async ({
  promotionId,
  showId,
}: {
  promotionId: string;
  showId: string;
}): Promise<ChampionParticipant[]> => {
  const { data: pickData, error: pickError } = await supabaseAdmin
    .from("picks")
    .select("user_id")
    .eq("show_id", showId);

  if (pickError) {
    throw new Error(pickError.message);
  }

  const userIds = [...new Set(((pickData ?? []) as { user_id: string }[]).map((row) => row.user_id))];
  if (userIds.length === 0) return [];

  const { data: claimData, error: claimError } = await supabaseAdmin
    .from("champion_claims")
    .select(
      "claimed_by_user_id, claimed_username, claimed_avatar, claim_type, show_id, created_at"
    )
    .eq("promotion_id", promotionId)
    .eq("claim_type", "show_winner")
    .in("claimed_by_user_id", userIds)
    .order("created_at", { ascending: false });

  if (claimError) {
    throw new Error(claimError.message);
  }

  const latestClaimByUserId = new Map<
    string,
    {
      claimed_by_user_id: string | null;
      claimed_username: string;
      claimed_avatar: string | null;
      claim_type: ChampionClaimType;
      show_id: string | null;
      created_at: string;
    }
  >();

  for (const claim of (claimData ?? []) as {
    claimed_by_user_id: string | null;
    claimed_username: string;
    claimed_avatar: string | null;
    claim_type: ChampionClaimType;
    show_id: string | null;
    created_at: string;
  }[]) {
    if (!claim.claimed_by_user_id) continue;
    if (!latestClaimByUserId.has(claim.claimed_by_user_id)) {
      latestClaimByUserId.set(claim.claimed_by_user_id, claim);
    }
  }

  const championUserIds = [...latestClaimByUserId.keys()];
  if (championUserIds.length === 0) return [];

  const { data: profileData, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, avatar_key")
    .in("id", championUserIds);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profileMap = new Map(
    ((profileData ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );

  return championUserIds.map((userId) => {
    const claim = latestClaimByUserId.get(userId)!;
    const profile = profileMap.get(userId) ?? null;
    return {
      user_id: userId,
      display_name:
        profile?.display_name?.trim() || claim.claimed_username || "Anonymous",
      avatar_key: profile?.avatar_key ?? claim.claimed_avatar ?? null,
      claim_type: claim.claim_type,
      claimed_show_id: claim.show_id,
    };
  });
};

export const getChampionClaimsForUser = async (
  userId: string
): Promise<ChampionProfileClaim[]> => {
  if (!userId) return [];

  const { data: claimData, error: claimError } = await supabaseAdmin
    .from("champion_claims")
    .select(
      "id, promotion_id, show_id, claim_type, claimed_username, claimed_avatar, created_at"
    )
    .eq("claimed_by_user_id", userId)
    .order("created_at", { ascending: false });

  if (claimError) {
    throw new Error(claimError.message);
  }

  const claims = (claimData ?? []) as {
    id: string;
    promotion_id: string;
    show_id: string | null;
    claim_type: ChampionClaimType;
    claimed_username: string;
    claimed_avatar: string | null;
    created_at: string;
  }[];

  if (claims.length === 0) return [];

  const promotionIds = [...new Set(claims.map((claim) => claim.promotion_id).filter(Boolean))];
  const showIds = [...new Set(claims.map((claim) => claim.show_id).filter(Boolean))] as string[];

  const [{ data: promotionData, error: promotionError }, { data: showData, error: showError }] =
    await Promise.all([
      promotionIds.length > 0
        ? supabaseAdmin
            .from("promotions")
            .select("id, name, image_url")
            .in("id", promotionIds)
        : Promise.resolve({ data: [], error: null }),
      showIds.length > 0
        ? supabaseAdmin
            .from("shows")
            .select("id, name, starts_at")
            .in("id", showIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (promotionError) {
    throw new Error(promotionError.message);
  }
  if (showError) {
    throw new Error(showError.message);
  }

  const promotionMap = new Map(
    ((promotionData ?? []) as PromotionRow[]).map((promotion) => [promotion.id, promotion])
  );
  const showMap = new Map(
    ((showData ?? []) as { id: string; name: string; starts_at: string | null }[]).map((show) => [
      show.id,
      show,
    ])
  );

  return claims.map((claim) => {
    const promotion = promotionMap.get(claim.promotion_id) ?? null;
    const show = claim.show_id ? showMap.get(claim.show_id) ?? null : null;
    return {
      id: claim.id,
      promotion_id: claim.promotion_id,
      promotion_name: promotion?.name ?? "Promotion",
      promotion_image_url: promotion?.image_url ?? null,
      show_id: claim.show_id,
      show_name: show?.name ?? null,
      show_starts_at: show?.starts_at ?? null,
      claim_type: claim.claim_type,
      claimed_username: claim.claimed_username,
      claimed_avatar: claim.claimed_avatar,
      created_at: claim.created_at,
    };
  });
};
