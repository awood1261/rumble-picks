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
  PromotionLineagePageData,
  PromotionLineageReign,
  PromotionLineageStatus,
  TitleLandingPromotionCard,
  ChampionProfileClaim,
  ChampionPromotion,
  PromotionChampionshipStatus,
} from "./championTypes";

type ShowRow = {
  id: string;
  name: string;
  starts_at: string | null;
  promotion_id: string | null;
  is_over?: boolean | null;
  use_confidence_points?: boolean | null;
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

type ResolvedShowChampion = {
  show_id: string;
  show_name: string;
  won_at: string | null;
  champion_user_id: string | null;
  champion_username: string | null;
  champion_avatar: string | null;
  identity_key: string | null;
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

const championIdentityKey = ({
  userId,
  username,
  avatar,
}: {
  userId: string | null;
  username: string | null;
  avatar: string | null;
}) => {
  if (userId) return `user:${userId}`;
  const trimmedUsername = username?.trim() ?? "";
  if (!trimmedUsername) return null;
  return `name:${trimmedUsername.toLowerCase()}::${avatar ?? ""}`;
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
    .select("id, name, starts_at, promotion_id, is_over, use_confidence_points")
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
    .select("id, name, starts_at, promotion_id, is_over, use_confidence_points")
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
        "id, show_id, match_type, winner_entrant_id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id, match_length, match_interference, gauntlet_survival_result, gauntlet_final_entrant_id"
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
    { data: gauntletActualData, error: gauntletActualError },
    { data: eliminatorEntryData, error: eliminatorEntryError },
    { data: eliminatorEliminationData, error: eliminatorEliminationError },
  ] = await Promise.all([
    matchIds.length > 0
      ? supabaseAdmin
          .from("match_sides")
          .select("id, match_id, label, image_url")
          .in("match_id", matchIds)
      : Promise.resolve({ data: [], error: null }),
    matchIds.length > 0
      ? supabaseAdmin
          .from("match_entrants")
          .select("match_id, entrant_id, side_id")
          .in("match_id", matchIds)
      : Promise.resolve({ data: [], error: null }),
    matchIds.length > 0
      ? supabaseAdmin
          .from("gauntlet_actual_entrants")
          .select("match_id, entrant_id")
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
  if (gauntletActualError) throw new Error(gauntletActualError.message);
  if (eliminatorEntryError) throw new Error(eliminatorEntryError.message);
  if (eliminatorEliminationError) {
    throw new Error(eliminatorEliminationError.message);
  }

  const matchSides = (matchSideData ?? []) as MatchSideRow[];
  const matchEntrants = (matchEntrantData ?? []) as MatchEntrantRow[];
  const gauntletActualEntrants = (gauntletActualData ?? []) as {
    match_id: string;
    entrant_id: string;
  }[];
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
      {
        ironPersonId: showIronPersonId,
        useConfidencePoints: show.use_confidence_points ?? false,
      },
      eliminatorEntries.filter((entry) => showEliminatorIds.has(entry.eliminator_id)),
      eliminatorEliminations.filter((entry) =>
        showEliminatorIds.has(entry.eliminator_id)
      ),
      showEliminators,
      showQuestions,
      gauntletActualEntrants.filter((entry) => showMatchIds.has(entry.match_id))
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

const getResolvedChampionForCompletedShow = async ({
  promotionId,
  showId,
}: {
  promotionId: string;
  showId: string;
}): Promise<ResolvedShowChampion | null> => {
  const winner = await getChampionWinnerForShow(promotionId, showId);
  if (!winner) return null;

  const { data: claimData, error: claimError } = await supabaseAdmin
    .from("champion_claims")
    .select("claimed_by_user_id, claimed_username, claimed_avatar, created_at")
    .eq("promotion_id", promotionId)
    .eq("claim_type", "show_winner")
    .eq("show_id", showId)
    .not("claimed_by_user_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (claimError) {
    throw new Error(claimError.message);
  }

  const claimedChampion = (
    (claimData ?? []) as {
      claimed_by_user_id: string | null;
      claimed_username: string;
      claimed_avatar: string | null;
      created_at: string;
    }[]
  )[0] ?? null;

  const championUserId =
    claimedChampion?.claimed_by_user_id ?? winner.winner_user_id ?? null;
  const championUsername =
    claimedChampion?.claimed_username ?? winner.winner_username ?? null;
  const championAvatar =
    claimedChampion?.claimed_avatar ?? winner.winner_avatar ?? null;

  return {
    show_id: winner.id,
    show_name: winner.name,
    won_at: winner.starts_at,
    champion_user_id: championUserId,
    champion_username: championUsername,
    champion_avatar: championAvatar,
    identity_key: championIdentityKey({
      userId: championUserId,
      username: championUsername,
      avatar: championAvatar,
    }),
  };
};

const buildPromotionLineage = async (
  promotionId: string
): Promise<PromotionLineageReign[]> => {
  const { data: completedShowData, error: completedShowError } = await supabaseAdmin
    .from("shows")
    .select("id, name, starts_at")
    .eq("promotion_id", promotionId)
    .eq("is_over", true)
    .order("starts_at", { ascending: true, nullsFirst: true });

  if (completedShowError) {
    throw new Error(completedShowError.message);
  }

  const completedShows = (completedShowData ?? []) as {
    id: string;
    name: string;
    starts_at: string | null;
  }[];

  const resolvedChampions = (
    await Promise.all(
      completedShows.map((show) =>
        getResolvedChampionForCompletedShow({
          promotionId,
          showId: show.id,
        })
      )
    )
  ).filter((champion): champion is ResolvedShowChampion => Boolean(champion?.identity_key));

  const lineage: PromotionLineageReign[] = [];
  const reignCountsByChampion = new Map<string, number>();

  for (const champion of resolvedChampions) {
    const currentReign = lineage[lineage.length - 1] ?? null;
    const currentReignKey = currentReign
      ? championIdentityKey({
          userId: currentReign.champion_user_id,
          username: currentReign.champion_username,
          avatar: currentReign.champion_avatar,
        })
      : null;

    if (currentReign && currentReignKey === champion.identity_key) {
      currentReign.successful_defenses += 1;
      continue;
    }

    if (currentReign) {
      currentReign.ended_at = champion.won_at;
      currentReign.is_current = false;
    }

    const lineageNumber = lineage.length + 1;
    const championKey = champion.identity_key!;
    const reignNumber = (reignCountsByChampion.get(championKey) ?? 0) + 1;
    reignCountsByChampion.set(championKey, reignNumber);

    lineage.push({
      lineage_number: lineageNumber,
      reign_number: reignNumber,
      champion_user_id: champion.champion_user_id,
      champion_username: champion.champion_username ?? "Anonymous",
      champion_avatar: champion.champion_avatar,
      won_show_id: champion.show_id,
      won_show_name: champion.show_name,
      won_at: champion.won_at,
      ended_at: null,
      successful_defenses: 0,
      is_current: true,
    });
  }

  return lineage.reverse();
};

export const getPromotionLineagePageData = async (
  promotionId: string
): Promise<PromotionLineagePageData> => {
  const promotion = await getChampionPromotion(promotionId);
  const lineage = await buildPromotionLineage(promotionId);

  const { data: activeShowData, error: activeShowError } = await supabaseAdmin
    .from("shows")
    .select("id, name, starts_at")
    .eq("promotion_id", promotionId)
    .eq("is_over", false)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .limit(1);

  if (activeShowError) {
    throw new Error(activeShowError.message);
  }

  const activeShow = (
    (activeShowData ?? []) as { id: string; name: string; starts_at: string | null }[]
  )[0] ?? null;

  let status: PromotionLineageStatus;
  if (lineage.length === 0) {
    status = {
      status: "inaugural",
      champion_user_id: null,
      champion_username: null,
      champion_avatar: null,
      reign_number: null,
      successful_defenses: null,
      active_show_id: activeShow?.id ?? null,
      active_show_name: activeShow?.name ?? null,
    };
  } else {
    const currentChampion = lineage[0];
    let isDefending = false;

    if (activeShow?.id && currentChampion.champion_user_id) {
      const { data: registrationData, error: registrationError } = await supabaseAdmin
        .from("picks")
        .select("user_id")
        .eq("show_id", activeShow.id)
        .eq("user_id", currentChampion.champion_user_id)
        .limit(1);

      if (registrationError) {
        throw new Error(registrationError.message);
      }

      isDefending = ((registrationData ?? []) as { user_id: string }[]).length > 0;
    }

    status = {
      status: isDefending ? "defending" : "vacant",
      champion_user_id: currentChampion.champion_user_id,
      champion_username: currentChampion.champion_username,
      champion_avatar: currentChampion.champion_avatar,
      reign_number: currentChampion.reign_number,
      successful_defenses: currentChampion.successful_defenses,
      active_show_id: activeShow?.id ?? null,
      active_show_name: activeShow?.name ?? null,
    };
  }

  return {
    promotion,
    status,
    lineage,
    call_to_action_show_id: activeShow?.id ?? null,
  };
};

export const getFeaturedTitlePromotionId = async (): Promise<string | null> => {
  const { data, error } = await supabaseAdmin
    .from("shows")
    .select("promotion_id, starts_at")
    .eq("is_featured_play_show", true)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const featuredShow = (
    (data ?? []) as { promotion_id: string | null; starts_at: string | null }[]
  )[0] ?? null;

  return featuredShow?.promotion_id ?? null;
};

export const getTitleLandingPromotionCards = async (): Promise<
  TitleLandingPromotionCard[]
> => {
  const { data, error } = await supabaseAdmin
    .from("promotions")
    .select("id, name, image_url")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const promotions = (data ?? []) as PromotionRow[];
  const cardData = await Promise.all(
    promotions.map(async (promotion) => {
      const lineageData = await getPromotionLineagePageData(promotion.id);
      const reigningChampion = lineageData.lineage[0] ?? null;
      return {
        promotion_id: promotion.id,
        promotion_name: promotion.name,
        promotion_image_url: promotion.image_url,
        reigning_champion_username: reigningChampion?.champion_username ?? null,
        reigning_champion_avatar: reigningChampion?.champion_avatar ?? null,
        status: lineageData.status.status,
        reign_count: lineageData.lineage.length,
        total_defenses: lineageData.lineage.reduce(
          (sum, reign) => sum + reign.successful_defenses,
          0
        ),
      } satisfies TitleLandingPromotionCard;
    })
  );

  return cardData;
};

export const getPromotionChampionshipStatus = async ({
  promotionId,
  showId,
}: {
  promotionId: string;
  showId: string;
}): Promise<PromotionChampionshipStatus> => {
  const { data: currentShowData, error: currentShowError } = await supabaseAdmin
    .from("shows")
    .select("id, starts_at, promotion_id")
    .eq("id", showId)
    .eq("promotion_id", promotionId)
    .maybeSingle();

  if (currentShowError) {
    throw new Error(currentShowError.message);
  }

  const currentShow = currentShowData as
    | { id: string; starts_at: string | null; promotion_id: string | null }
    | null;

  if (!currentShow) {
    throw new Error("Show not found for promotion.");
  }

  let previousShowsQuery = supabaseAdmin
    .from("shows")
    .select("id, name, starts_at")
    .eq("promotion_id", promotionId)
    .eq("is_over", true)
    .neq("id", showId)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (currentShow.starts_at) {
    previousShowsQuery = previousShowsQuery.lt("starts_at", currentShow.starts_at);
  }

  const { data: previousShowData, error: previousShowError } =
    await previousShowsQuery;

  if (previousShowError) {
    throw new Error(previousShowError.message);
  }

  const previousShow = (
    (previousShowData ?? []) as { id: string; name: string; starts_at: string | null }[]
  )[0];

  if (!previousShow) {
    return {
      status: "inaugural",
      previous_show_id: null,
      previous_show_name: null,
      champion_user_id: null,
      champion_username: null,
      champion_avatar: null,
    };
  }

  const previousChampion = await getResolvedChampionForCompletedShow({
    promotionId,
    showId: previousShow.id,
  });

  const reigningChampionUserId = previousChampion?.champion_user_id ?? null;
  const reigningChampionUsername = previousChampion?.champion_username ?? null;
  const reigningChampionAvatar = previousChampion?.champion_avatar ?? null;

  if (!reigningChampionUserId) {
    return {
      status: "vacant",
      previous_show_id: previousShow.id,
      previous_show_name: previousShow.name,
      champion_user_id: null,
      champion_username: null,
      champion_avatar: null,
    };
  }

  const { data: registrationData, error: registrationError } = await supabaseAdmin
    .from("picks")
    .select("user_id")
    .eq("show_id", showId)
    .eq("user_id", reigningChampionUserId)
    .limit(1);

  if (registrationError) {
    throw new Error(registrationError.message);
  }

  const isRegistered = ((registrationData ?? []) as { user_id: string }[]).length > 0;

  return {
    status: isRegistered ? "defending" : "vacant",
    previous_show_id: previousShow.id,
    previous_show_name: previousShow.name,
    champion_user_id: reigningChampionUserId,
    champion_username: reigningChampionUsername,
    champion_avatar: reigningChampionAvatar,
  };
};
