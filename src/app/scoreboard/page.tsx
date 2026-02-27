"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { avatarSrcForKey } from "../../lib/avatarOptions";
import { ScoreboardCountdown } from "../../components/ScoreboardCountdown";
import { scoringRules } from "../../lib/scoringRules";
import { calculateScore } from "../../lib/scoring";

type ScoreRow = {
  id: string;
  user_id: string;
  show_id: string | null;
  points: number;
  breakdown: Record<string, number> | null;
  updated_at: string;
};

type PickRow = {
  id: string;
  user_id: string;
  rumbles?: Record<
    string,
    {
      entrants: string[];
      final_four: string[];
      winner: string | null;
      entry_1: string | null;
      entry_2: string | null;
      entry_30: string | null;
      iron_person: string | null;
      most_eliminations: string | null;
    }
  >;
  eliminators?: Record<
    string,
    {
      entry_order?: Record<string, number | null>;
      elimination_order?: Record<string, number | null>;
      elimination_type?: Record<string, "pinfall" | "submission" | null>;
      most_eliminations?: string | null;
    }
  >;
  match_picks?: Record<string, string | null>;
  match_finish_picks?: Record<
    string,
    { method: string | null; winner: string | null; loser: string | null }
  >;
  match_length_picks?: Record<string, "sprint" | "standard" | "epic" | null>;
  match_interference_picks?: Record<string, "yes" | "no" | null>;
  updated_at: string;
};

type RumblePick = NonNullable<PickRow["rumbles"]>[string];

type ShowRow = {
  id: string;
  name: string;
  tagline?: string | null;
  promotion_id: string | null;
};

type PromotionRow = {
  id: string;
  name: string;
  image_url: string | null;
};

type EventRow = {
  id: string;
  name: string;
  show_id: string | null;
  rumble_gender: string | null;
  iron_person_entrant_id?: string | null;
  order_index?: number | null;
};

type RumbleEntryRow = {
  event_id: string;
  entrant_id: string;
  entry_number: number | null;
  eliminated_at: string | null;
  is_confirmed?: boolean;
};

type EventEntrantRow = {
  id: string;
  name: string;
  promotion: string | null;
};

type MatchRow = {
  id: string;
  winner_side_id: string | null;
  finish_method: string | null;
  finish_winner_entrant_id: string | null;
  finish_loser_entrant_id: string | null;
  match_length?: string | null;
  match_interference?: string | null;
};

type MatchSideRow = {
  id: string;
  match_id: string;
  label: string | null;
};

type MatchEntrantRow = {
  match_id: string;
  entrant_id: string;
  side_id: string | null;
};

type EliminatorEntryRow = {
  eliminator_id: string;
  entrant_id: string;
  entry_order: number | null;
};

type EliminatorEliminationRow = {
  eliminator_id: string;
  eliminated_entrant_id: string;
  eliminated_by_entrant_id: string | null;
  elimination_type: "pinfall" | "submission";
  elimination_order: number;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_key: string | null;
};

type ScoreboardRow = ScoreRow & { display_name: string; avatar_key: string | null };

const SCOREBOARD_POLL_INTERVAL_MS = 120000;

const MovementPill = ({ delta }: { delta: number | null }) => {
  if (typeof delta !== "number" || delta === 0) return null;
  const isUp = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
        isUp
          ? "border-[color:var(--bp-green)]/40 text-[color:var(--bp-green)]"
          : "border-[color:var(--bp-red)]/40 text-[color:var(--bp-red)]"
      }`}
    >
      {isUp ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
};

const UpdateProgress = () => (
  <div className="mt-6 rounded-2xl border border-white/5 bg-[color:var(--bp-surface)] px-4 py-3">
    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-[color:var(--bp-dim)]">
      <span>Next scoring update</span>
      <span className="text-[color:var(--bp-gold)]">Live</span>
    </div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
      <div className="h-full w-full animate-[bp-score-pulse_30s_linear_infinite] bg-[color:var(--bp-gold)]" />
    </div>
  </div>
);

export default function ScoreboardPage() {
  const searchParams = useSearchParams();
  const queryShowId = searchParams.get("show");
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedShowId, setSelectedShowId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rumbleEntries, setRumbleEntries] = useState<RumbleEntryRow[]>([]);
  const [eventEntrants, setEventEntrants] = useState<EventEntrantRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchSides, setMatchSides] = useState<MatchSideRow[]>([]);
  const [matchEntrants, setMatchEntrants] = useState<MatchEntrantRow[]>([]);
  const [eliminatorEntries, setEliminatorEntries] = useState<
    EliminatorEntryRow[]
  >([]);
  const [eliminatorEliminations, setEliminatorEliminations] = useState<
    EliminatorEliminationRow[]
  >([]);
  const [eliminatorIds, setEliminatorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [rankDelta, setRankDelta] = useState<Record<string, number | null>>({});
  const previousRanksRef = useRef<Record<string, number>>({});
  const lastDeltaRef = useRef<Record<string, number>>({});
  const [lastUpdateAt, setLastUpdateAt] = useState(Date.now());
  const [progressOpen, setProgressOpen] = useState(false);
  const loadScoresRef = useRef<() => void>(() => {});
  const loadRumbleEntriesRef = useRef<() => void>(() => {});

  const selectedShow = useMemo(
    () => shows.find((show) => show.id === selectedShowId) ?? null,
    [shows, selectedShowId]
  );
  const selectedPromotion = useMemo(() => {
    if (!selectedShow?.promotion_id) return null;
    return promotions.find((promotion) => promotion.id === selectedShow.promotion_id) ?? null;
  }, [promotions, selectedShow?.promotion_id]);

  const scoreboard = useMemo(() => {
    const profileMap = new Map(
      profiles.map((profile) => [
        profile.id,
        {
          display_name: profile.display_name ?? "Anonymous",
          avatar_key: profile.avatar_key ?? null,
        },
      ])
    );
    return scores
      .map((score) => ({
        ...score,
        display_name: profileMap.get(score.user_id)?.display_name ?? "Anonymous",
        avatar_key: profileMap.get(score.user_id)?.avatar_key ?? null,
      }))
      .sort((a, b) => b.points - a.points);
  }, [scores, profiles]);

  const showEvents = useMemo(
    () =>
      events
        .filter((event) => event.show_id === selectedShowId)
        .sort(
          (a, b) =>
            (a.order_index ?? 9999) - (b.order_index ?? 9999) ||
            a.name.localeCompare(b.name)
        ),
    [events, selectedShowId]
  );

  const filteredScoreboard = useMemo(() => {
    if (!selectedShowId) return [];
    return scoreboard.filter((row) => row.show_id === selectedShowId);
  }, [scoreboard, selectedShowId]);

  const topThree = useMemo(() => filteredScoreboard.slice(0, 3), [filteredScoreboard]);
  const currentUserIndex = useMemo(() => {
    if (!currentUserId) return null;
    const idx = filteredScoreboard.findIndex(
      (row) => row.user_id === currentUserId
    );
    return idx >= 0 ? idx : null;
  }, [currentUserId, filteredScoreboard]);

  const winnerEntrantsByEvent = useMemo(() => {
    const winners: Record<string, string | null> = {};
    showEvents.forEach((event) => {
      const entries = rumbleEntries.filter((entry) => entry.event_id === event.id);
      if (entries.length < 30) {
        winners[event.id] = null;
        return;
      }
      const remaining = entries.filter((entry) => !entry.eliminated_at);
      winners[event.id] = remaining.length === 1 ? remaining[0].entrant_id : null;
    });
    return winners;
  }, [rumbleEntries, showEvents]);

  const matchEntrantCountByMatch = useMemo(() => {
    return matchEntrants.reduce((map, item) => {
      map[item.match_id] = (map[item.match_id] ?? 0) + 1;
      return map;
    }, {} as Record<string, number>);
  }, [matchEntrants]);

  const eventsComplete = useMemo(() => {
    if (showEvents.length === 0) return true;
    return showEvents.every((event) => Boolean(winnerEntrantsByEvent[event.id]));
  }, [showEvents, winnerEntrantsByEvent]);

  const matchesComplete = useMemo(() => {
    if (matches.length === 0) return true;
    return matches.every((match) => {
      if (
        !match.winner_side_id ||
        !match.finish_method ||
        !match.match_length ||
        !match.match_interference
      ) {
        return false;
      }
      if (
        (match.finish_method === "pinfall" ||
          match.finish_method === "submission") &&
        (matchEntrantCountByMatch[match.id] ?? 0) > 2
      ) {
        return (
          Boolean(match.finish_winner_entrant_id) &&
          Boolean(match.finish_loser_entrant_id)
        );
      }
      return true;
    });
  }, [matches, matchEntrantCountByMatch]);

  const showResultsComplete = eventsComplete && matchesComplete;

  const entrantMap = useMemo(() => {
    return new Map(eventEntrants.map((entrant) => [entrant.id, entrant]));
  }, [eventEntrants]);

  const entryNumberMap = useMemo(() => {
    return new Map(
      rumbleEntries.map((entry) => [entry.entrant_id, entry.entry_number])
    );
  }, [rumbleEntries]);

  const entriesByEvent = useMemo(() => {
    const byEvent: Record<string, RumbleEntryRow[]> = {};
    showEvents.forEach((event) => {
      byEvent[event.id] = rumbleEntries.filter(
        (entry) => entry.event_id === event.id
      );
    });
    return byEvent;
  }, [rumbleEntries, showEvents]);

  const remainingEntrantsByEvent = useMemo(() => {
    const map: Record<string, EventEntrantRow[]> = {};
    Object.entries(entriesByEvent).forEach(([eventId, entries]) => {
      const remainingIds = new Set(
        entries.filter((entry) => !entry.eliminated_at).map((entry) => entry.entrant_id)
      );
      map[eventId] = eventEntrants.filter((entrant) => remainingIds.has(entrant.id));
    });
    return map;
  }, [entriesByEvent, eventEntrants]);

  const eventProgressItems = useMemo(() => {
    if (showEvents.length === 0) {
      return ["No rumble events on this show yet."];
    }
    return showEvents.map((event) => {
      const total = entriesByEvent[event.id]?.length ?? 0;
      const remaining = remainingEntrantsByEvent[event.id]?.length ?? 0;
      return `${event.name}: ${total} entrants • ${remaining} remaining`;
    });
  }, [entriesByEvent, remainingEntrantsByEvent, showEvents]);

  const eliminatedEntrantIdsByEvent = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    Object.entries(entriesByEvent).forEach(([eventId, entries]) => {
      map[eventId] = new Set(
        entries.filter((entry) => entry.eliminated_at).map((entry) => entry.entrant_id)
      );
    });
    return map;
  }, [entriesByEvent]);

  const computeRumbleScore = useCallback(
    (
      pick: RumblePick | undefined,
      entries: RumbleEntryRow[],
      ironOverride?: string | null
    ) => {
      if (!pick) {
        return { points: 0, breakdown: {} as Record<string, number> };
      }
      const totalEntries = entries.length;
      const remainingCount = entries.filter((entry) => !entry.eliminated_at).length;
      const finalFourReady = totalEntries >= 4 && remainingCount <= 4;
      const winnerReady = totalEntries >= 30 && remainingCount === 1;
      const mostElimsReady = winnerReady;
      const entrantIds = new Set(
        entries.filter((entry) => !entry.is_confirmed).map((entry) => entry.entrant_id)
      );
      const correctEntrants = (pick.entrants ?? []).filter((id) =>
        entrantIds.has(id)
      );
      const finalFour = [...entries]
        .sort((a, b) => {
          const aKey = a.eliminated_at ? new Date(a.eliminated_at).getTime() : Number.MAX_SAFE_INTEGER;
          const bKey = b.eliminated_at ? new Date(b.eliminated_at).getTime() : Number.MAX_SAFE_INTEGER;
          return bKey - aKey;
        })
        .slice(0, 4)
        .map((entry) => entry.entrant_id);
      const finalFourSet = finalFourReady ? new Set(finalFour) : new Set();
      const correctFinalFour = (pick.final_four ?? []).filter((id) =>
        finalFourSet.has(id)
      );
      const winners = entries.filter((entry) => !entry.eliminated_at);
      const actualWinner =
        winnerReady ? winners[0].entrant_id : null;
      const entryOne = entries.find((entry) => entry.entry_number === 1)?.entrant_id ?? null;
      const entryTwo = entries.find((entry) => entry.entry_number === 2)?.entrant_id ?? null;
      const entryThirty = entries.find((entry) => entry.entry_number === 30)?.entrant_id ?? null;
      const maxElims = entries.reduce(
        (max, entry) => Math.max(max, entry.eliminations_count ?? 0),
        0
      );
      const topElims = new Set(
        entries
          .filter((entry) => entry.eliminations_count === maxElims)
          .map((entry) => entry.entrant_id)
      );

      const breakdown = {
        entrants: correctEntrants.length * scoringRules.entrants,
        final_four: finalFourReady
          ? correctFinalFour.length * scoringRules.final_four
          : 0,
        winner:
          actualWinner && pick.winner === actualWinner ? scoringRules.winner : 0,
        entry_1:
          pick.entry_1 && pick.entry_1 === entryOne ? scoringRules.entry_1 : 0,
        entry_2:
          pick.entry_2 && pick.entry_2 === entryTwo ? scoringRules.entry_2 : 0,
        entry_30:
          pick.entry_30 && pick.entry_30 === entryThirty ? scoringRules.entry_30 : 0,
        iron_person:
          winnerReady &&
          pick.iron_person &&
          (ironOverride ??
            [...entries]
              .filter((entry) => entry.eliminated_at)
              .sort((a, b) => {
                const aKey = a.eliminated_at ? new Date(a.eliminated_at).getTime() : 0;
                const bKey = b.eliminated_at ? new Date(b.eliminated_at).getTime() : 0;
                return bKey - aKey;
              })[0]?.entrant_id) === pick.iron_person
            ? scoringRules.iron_person
            : 0,
        most_eliminations:
          mostElimsReady &&
          pick.most_eliminations &&
          topElims.has(pick.most_eliminations)
            ? scoringRules.most_eliminations
            : 0,
      };
      const points =
        breakdown.entrants +
        breakdown.final_four +
        breakdown.winner +
        breakdown.entry_1 +
        breakdown.entry_2 +
        breakdown.entry_30 +
        breakdown.iron_person +
        breakdown.most_eliminations;
      return { points, breakdown };
    },
    []
  );

  const loadScores = useCallback(async () => {
    setMessage(null);
    if (!selectedShowId) {
      setScores([]);
      setProfiles([]);
      setLoading(false);
      return;
    }
    const { data: pickRows, error: pickError } = await supabase
      .from("picks")
      .select(
        "id, user_id, updated_at, rumbles:payload->rumbles, eliminators:payload->eliminators, match_picks:payload->match_picks, match_finish_picks:payload->match_finish_picks, match_length_picks:payload->match_length_picks, match_interference_picks:payload->match_interference_picks"
      )
      .eq("show_id", selectedShowId);

    if (pickError) {
      setMessage(pickError.message);
      setLoading(false);
      return;
    }

    const picks = (pickRows ?? []) as PickRow[];
    const userIds = Array.from(new Set(picks.map((row) => row.user_id)));
    if (userIds.length === 0) {
      setScores([]);
      setProfiles([]);
      setLoading(false);
      setLastUpdateAt(Date.now());
      return;
    }
    const { data: profileRowsFresh, error: profileErrorFresh } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_key")
      .in("id", userIds);
    if (profileErrorFresh) {
      setMessage(profileErrorFresh.message);
    }

    const eventEntriesById = rumbleEntries.reduce((map, entry) => {
      if (!map[entry.event_id]) map[entry.event_id] = [];
      map[entry.event_id].push(entry);
      return map;
    }, {} as Record<string, RumbleEntryRow[]>);

    const scoreboardRows: ScoreRow[] = picks.map((pick) => {
      let points = 0;
      const breakdown: Record<string, number> = {};
      const rumbles = pick.rumbles ?? {};
      showEvents.forEach((event) => {
        const entries = eventEntriesById[event.id] ?? [];
        const rumblePick = rumbles[event.id];
        const rumbleScore = computeRumbleScore(
          rumblePick,
          entries,
          event.iron_person_entrant_id ?? null
        );
        points += rumbleScore.points;
        Object.entries(rumbleScore.breakdown).forEach(([key, value]) => {
          breakdown[`${event.id}:${key}`] = value;
        });
      });

      const matchPayload = {
        entrants: [],
        final_four: [],
        winner: null,
        entry_1: null,
        entry_2: null,
        entry_30: null,
        iron_person: null,
        most_eliminations: null,
        eliminators: pick.eliminators ?? {},
        match_picks: pick.match_picks ?? {},
        match_finish_picks: pick.match_finish_picks ?? {},
        match_length_picks: pick.match_length_picks ?? {},
        match_interference_picks: pick.match_interference_picks ?? {},
      };
      const matchScore = calculateScore(
        matchPayload,
        [],
        scoringRules,
        matches,
        matchEntrants,
        matchSides,
        undefined,
        eliminatorEntries,
        eliminatorEliminations
      );
      points += matchScore.points;
      breakdown.matches = matchScore.breakdown.matches ?? 0;
      breakdown.match_finish_method = matchScore.breakdown.match_finish_method ?? 0;
      breakdown.match_length = matchScore.breakdown.match_length ?? 0;
      breakdown.match_interference = matchScore.breakdown.match_interference ?? 0;

      return {
        id: pick.id,
        user_id: pick.user_id,
        show_id: selectedShowId,
        points,
        breakdown,
        updated_at: pick.updated_at,
      };
    });

    const eventScores = [...scoreboardRows].sort((a, b) => b.points - a.points);
    const nextRankMap: Record<string, number> = {};
    eventScores.forEach((row, index) => {
      nextRankMap[row.user_id] = index + 1;
    });
    const updated: Record<string, number | null> = { ...lastDeltaRef.current };
    eventScores.forEach((row) => {
      const prevRank = previousRanksRef.current[row.user_id];
      if (typeof prevRank === "number") {
        const delta = prevRank - nextRankMap[row.user_id];
        if (delta !== 0) {
          updated[row.user_id] = delta;
        }
      } else if (!(row.user_id in updated)) {
        updated[row.user_id] = null;
      }
    });
    setRankDelta(updated);
    previousRanksRef.current = nextRankMap;
    lastDeltaRef.current = Object.fromEntries(
      Object.entries(updated).filter(([, value]) => value !== null)
    ) as Record<string, number>;

    setScores(scoreboardRows);
    setProfiles(profileRowsFresh ?? []);
    setLoading(false);
  }, [
    computeRumbleScore,
    matchEntrants,
    matchSides,
    matches,
    rumbleEntries,
    selectedShowId,
    showEvents,
  ]);

  const loadRumbleEntries = useCallback(async () => {
    if (!selectedShowId || showEvents.length === 0) {
      setRumbleEntries((prev) => (prev.length === 0 ? prev : []));
      setEventEntrants((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const eventIds = showEvents.map((event) => event.id);
      const { data: entryRows, error } = await supabase
      .from("rumble_entries")
      .select("event_id, entrant_id, entry_number, eliminated_at, is_confirmed")
      .in("event_id", eventIds);
    if (error) {
      setMessage(error.message);
      return;
    }
    const nextEntries = (entryRows ?? []) as RumbleEntryRow[];
    setRumbleEntries((prev) => {
      if (prev.length === nextEntries.length) {
        const prevKey = prev
          .map(
            (entry) =>
              `${entry.event_id}:${entry.entrant_id}:${entry.entry_number ?? ""}:${entry.eliminated_at ?? ""}`
          )
          .sort()
          .join("|");
        const nextKey = nextEntries
          .map(
            (entry) =>
              `${entry.event_id}:${entry.entrant_id}:${entry.entry_number ?? ""}:${entry.eliminated_at ?? ""}`
          )
          .sort()
          .join("|");
        if (prevKey === nextKey) {
          return prev;
        }
      }
      return nextEntries;
    });

    const entrantIds = Array.from(
      new Set((entryRows ?? []).map((entry) => entry.entrant_id))
    );
    if (entrantIds.length === 0) {
      setEventEntrants([]);
      return;
    }

    const { data: entrantRows, error: entrantError } = await supabase
      .from("entrants")
      .select("id, name, promotion")
      .in("id", entrantIds)
      .order("name", { ascending: true });
    if (entrantError) {
      setMessage(entrantError.message);
      return;
    }
    setEventEntrants((prev) => {
      const next = entrantRows ?? [];
      if (prev.length === next.length) {
        const prevKey = prev.map((entrant) => entrant.id).sort().join("|");
        const nextKey = next.map((entrant) => entrant.id).sort().join("|");
        if (prevKey === nextKey) {
          return prev;
        }
      }
      return next;
    });
  }, [selectedShowId, showEvents]);

  useEffect(() => {
    loadScoresRef.current = loadScores;
  }, [loadScores]);

  useEffect(() => {
    loadRumbleEntriesRef.current = loadRumbleEntries;
  }, [loadRumbleEntries]);

  useEffect(() => {
    if (queryShowId && shows.some((show) => show.id === queryShowId)) {
      setSelectedShowId(queryShowId);
    }
  }, [queryShowId, shows]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id ?? null);
    });

    const loadShows = async () => {
      const [{ data: showRows, error: showError }, { data: promotionRows, error: promotionError }] =
        await Promise.all([
          supabase
            .from("shows")
            .select("id, name, image_url, promotion_id, status, starts_at")
            .order("starts_at", { ascending: true }),
          supabase
            .from("promotions")
            .select("id, name, image_url")
            .order("name", { ascending: true }),
        ]);
      if (showError) {
        setMessage(showError.message);
        return;
      }
      if (promotionError) {
        setMessage(promotionError.message);
        return;
      }
      setShows(showRows ?? []);
      setPromotions(promotionRows ?? []);
      if (showRows && showRows.length > 0) {
        const storedShowId =
          typeof window !== "undefined"
            ? window.localStorage.getItem("bp:lastShowId")
            : null;
        const defaultId =
          queryShowId && showRows.some((show) => show.id === queryShowId)
            ? queryShowId
            : storedShowId && showRows.some((show) => show.id === storedShowId)
              ? storedShowId
              : showRows[0].id;
        setSelectedShowId((current) => current || defaultId);
      }
    };

    const loadEvents = async () => {
      const { data: eventRows, error } = await supabase
        .from("events")
        .select("id, name, show_id, rumble_gender, iron_person_entrant_id, order_index")
        .order("order_index", { ascending: true, nullsLast: true })
        .order("name", { ascending: true });
      if (error) {
        setMessage(error.message);
        return;
      }
      setEvents(eventRows ?? []);
    };

    loadShows();
    loadEvents();
  }, [loadScores, queryShowId]);

  useEffect(() => {
    if (!selectedShowId || typeof window === "undefined") return;
    window.localStorage.setItem("bp:lastShowId", selectedShowId);
  }, [selectedShowId]);

  useEffect(() => {
    previousRanksRef.current = {};
    setRankDelta({});
    lastDeltaRef.current = {};
  }, [selectedShowId]);

  const loadEliminatorEntries = useCallback(async () => {
    if (!selectedShowId) {
      setEliminatorEntries([]);
      setEliminatorEliminations([]);
      setEliminatorIds([]);
      return;
    }
    const { data: eliminatorRows, error } = await supabase
      .from("eliminators")
      .select("id, order_index")
      .eq("show_id", selectedShowId)
      .order("order_index", { ascending: true, nullsLast: true });
    if (error) {
      setMessage(error.message);
      return;
    }
    const ids = (eliminatorRows ?? []).map((row) => row.id);
    setEliminatorIds(ids);
    if (ids.length === 0) {
      setEliminatorEntries([]);
      setEliminatorEliminations([]);
      return;
    }
    const { data: entryRows, error: entryError } = await supabase
      .from("eliminator_entries")
      .select("eliminator_id, entrant_id, entry_order")
      .in("eliminator_id", ids);
    if (entryError) {
      setMessage(entryError.message);
      return;
    }
    setEliminatorEntries((entryRows ?? []) as EliminatorEntryRow[]);
  }, [selectedShowId]);

  const loadEliminatorEliminations = useCallback(async () => {
    if (!selectedShowId) return;
    if (eliminatorIds.length === 0) {
      setEliminatorEliminations([]);
      return;
    }
    const { data: elimRows, error: elimError } = await supabase
      .from("eliminator_eliminations")
      .select(
        "eliminator_id, eliminated_entrant_id, eliminated_by_entrant_id, elimination_type, elimination_order"
      )
      .in("eliminator_id", eliminatorIds);
    if (elimError) {
      setMessage(elimError.message);
      return;
    }
    setEliminatorEliminations((elimRows ?? []) as EliminatorEliminationRow[]);
  }, [eliminatorIds, selectedShowId]);

  useEffect(() => {
    if (!selectedShowId) {
      return;
    }

    loadRumbleEntriesRef.current();
    loadScoresRef.current();
    loadEliminatorEntries();
    loadEliminatorEliminations();
    setLastUpdateAt(Date.now());

    if (typeof document !== "undefined" && document.hidden) {
      return;
    }

    const interval = setInterval(() => {
      setLastUpdateAt(Date.now());
      loadScoresRef.current();
      loadRumbleEntriesRef.current();
      loadEliminatorEliminations();
    }, SCOREBOARD_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [selectedShowId, showEvents, loadEliminatorEliminations, loadEliminatorEntries]);

  useEffect(() => {
    if (!selectedShowId) return;
    const handleVisibility = () => {
      if (document.hidden) return;
      setLastUpdateAt(Date.now());
      loadScoresRef.current();
      loadRumbleEntriesRef.current();
      loadEliminatorEliminations();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loadEliminatorEliminations, selectedShowId, showEvents]);

  useEffect(() => {
    const loadMatches = async () => {
      if (!selectedShowId) {
        setMatches([]);
        setMatchSides([]);
        setMatchEntrants([]);
        return;
      }
    const { data: matchRows, error } = await supabase
      .from("matches")
      .select(
        "id, order_index, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id, match_length, match_interference"
      )
      .eq("show_id", selectedShowId)
      .order("order_index", { ascending: true, nullsLast: true })
      .order("created_at", { ascending: true });
      if (error) {
        setMessage(error.message);
        return;
      }
      const matchList = (matchRows ?? []) as MatchRow[];
      setMatches(matchList);
      if (matchList.length === 0) {
        setMatchSides([]);
        setMatchEntrants([]);
        return;
      }
      const matchIds = matchList.map((match) => match.id);
      const [
        { data: sideRows, error: sideError },
        { data: entrantRows, error: entrantError },
      ] = await Promise.all([
        supabase.from("match_sides").select("id, match_id, label").in("match_id", matchIds),
        supabase.from("match_entrants").select("match_id, entrant_id, side_id").in("match_id", matchIds),
      ]);
      if (sideError) {
        setMessage(sideError.message);
        return;
      }
      if (entrantError) {
        setMessage(entrantError.message);
        return;
      }
      setMatchSides((sideRows ?? []) as MatchSideRow[]);
      setMatchEntrants((entrantRows ?? []) as MatchEntrantRow[]);
    };

    loadMatches();
  }, [selectedShowId]);

  useEffect(() => {
    loadEliminatorEntries();
    loadEliminatorEliminations();
  }, [loadEliminatorEliminations, loadEliminatorEntries]);

  return (
    <div
      className="relative min-h-screen text-[color:var(--bp-text)]"
      style={
        {
          "--bp-bg": "#111214",
          "--bp-surface": "rgba(255,255,255,0.04)",
          "--bp-surface-2": "rgba(255,255,255,0.06)",
          "--bp-text": "#F2F2F2",
          "--bp-muted": "#A7A7A7",
          "--bp-dim": "#6F6F6F",
          "--bp-gold": "#C6A24A",
          "--bp-gold-30": "rgba(198,162,74,0.30)",
          "--bp-gold-15": "rgba(198,162,74,0.15)",
          "--bp-silver": "#C9CCD1",
          "--bp-bronze": "#A9724A",
          "--bp-green": "#2ECC71",
          "--bp-red": "#E74C3C",
          backgroundColor: "#000000",
        } as CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.5) 0.5px, transparent 0.5px)",
          backgroundSize: "3px 3px",
        }}
      />
      {progressOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-6 pt-10">
          <div className="w-full max-w-5xl rounded-3xl border border-zinc-800 bg-zinc-950/95 p-6 text-sm text-zinc-100 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  Event progress
                </p>
                <h2 className="text-lg font-semibold">Rumble status</h2>
              </div>
              <button
                className="inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                type="button"
                onClick={() => setProgressOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {showEvents.map((event) => {
                const eventEntries = entriesByEvent[event.id] ?? [];
                const eliminatedSet = eliminatedEntrantIdsByEvent[event.id] ?? new Set();
                const remainingEntrants = remainingEntrantsByEvent[event.id] ?? [];
                const winnerEntrantId = winnerEntrantsByEvent[event.id];
                const entrantsForEvent = eventEntrants.filter((entrant) =>
                  eventEntries.some((entry) => entry.entrant_id === entrant.id)
                );
                return (
                  <div key={event.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-zinc-100">{event.name}</p>
                      <p className="text-xs text-zinc-400">
                        {eventEntries.length} entrants • {remainingEntrants.length} remaining
                      </p>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <details className="group rounded-2xl border border-zinc-800 bg-black/50 p-3">
                        <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
                          Entrants
                          <span className="text-zinc-600 transition group-open:rotate-180">▾</span>
                        </summary>
                        {entrantsForEvent.length === 0 ? (
                          <p className="mt-3 text-zinc-400">No entrants added yet.</p>
                        ) : (
                          <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1 text-zinc-300">
                            {[...entrantsForEvent]
                              .sort((a, b) => {
                                const aNum = entryNumberMap.get(a.id);
                                const bNum = entryNumberMap.get(b.id);
                                if (aNum == null && bNum == null) return a.name.localeCompare(b.name);
                                if (aNum == null) return 1;
                                if (bNum == null) return -1;
                                return aNum - bNum;
                              })
                              .map((entrant) => {
                                const eliminated = eliminatedSet.has(entrant.id);
                                return (
                                  <li key={entrant.id} className="flex items-center justify-between gap-2">
                                    <span className={eliminated ? "text-red-200" : "text-zinc-300"}>
                                      <span className="mr-2 text-[10px] font-semibold text-zinc-400">
                                        #{entryNumberMap.get(entrant.id) ?? "—"}
                                      </span>
                                      {entrant.name}
                                      {entrant.promotion ? ` • ${entrant.promotion}` : ""}
                                    </span>
                                    {eliminated ? (
                                      <span className="rounded-full border border-red-500/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                                        Eliminated
                                      </span>
                                    ) : null}
                                  </li>
                                );
                              })}
                          </ul>
                        )}
                      </details>
                      <details className="group rounded-2xl border border-zinc-800 bg-black/50 p-3">
                        <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
                          Remaining
                          <span className="text-zinc-600 transition group-open:rotate-180">▾</span>
                        </summary>
                        {remainingEntrants.length === 0 ? (
                          <p className="mt-3 text-zinc-400">
                            {winnerEntrantId ? "Winner determined." : "All entrants eliminated."}
                          </p>
                        ) : (
                          <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1 text-zinc-300">
                            {remainingEntrants.map((entrant) => (
                              <li key={entrant.id}>
                                {entrant.name}
                                {entrant.promotion ? ` • ${entrant.promotion}` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <main className="relative mx-auto w-full max-w-5xl pb-16 pt-12">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--bp-muted)]">
              Scoreboard
            </p>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-[color:var(--bp-gold)]">
              <span className="h-2 w-2 rounded-full bg-[color:var(--bp-gold)]" />
              Live updates
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedPromotion?.image_url ? (
              <div className="h-11 w-11 overflow-hidden rounded-full border border-[color:var(--bp-gold-30)] bg-black/40">
                <img
                  src={selectedPromotion.image_url}
                  alt={selectedPromotion.name ?? "Promotion"}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <h1 className="text-3xl font-semibold text-[color:var(--bp-text)] sm:text-4xl">
              {selectedShow?.name ?? "Show"}
            </h1>
          </div>
        </header>

        {message && (
          <div className="mt-6 rounded-2xl border border-white/5 bg-[color:var(--bp-surface)] px-4 py-3 text-sm text-[color:var(--bp-text)]">
            {message}
          </div>
        )}

        <section className="mt-8 space-y-6">
          {loading ? (
            <div className="space-y-6 animate-pulse">
              <div className="rounded-3xl border border-white/5 bg-[color:var(--bp-surface-2)] px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-28 rounded-full bg-white/10" />
                  <div className="h-4 w-20 rounded-full bg-white/10" />
                </div>
                <div className="mt-5 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-3xl bg-white/10" />
                  <div className="space-y-2">
                    <div className="h-3 w-20 rounded-full bg-white/10" />
                    <div className="h-6 w-44 rounded-full bg-white/10" />
                  </div>
                </div>
              </div>
              <div className="flex items-end justify-center gap-3 sm:gap-4">
                <div className="h-28 w-32 rounded-none border border-white/10 bg-[color:var(--bp-surface)] sm:h-32" />
                <div className="h-36 w-36 rounded-3xl border border-white/10 bg-[color:var(--bp-surface)] sm:h-40" />
                <div className="h-28 w-32 rounded-none border border-white/10 bg-[color:var(--bp-surface)] sm:h-32" />
              </div>
              <div className="rounded-3xl border border-white/5 bg-[color:var(--bp-surface)]">
                <div className="border-b border-white/5 px-6 py-4">
                  <div className="h-3 w-24 rounded-full bg-white/10" />
                </div>
                <div className="divide-y divide-white/5">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-4 px-6 py-4">
                      <div className="h-6 w-8 rounded-full bg-white/10" />
                      <div className="h-10 w-10 rounded-2xl bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-32 rounded-full bg-white/10" />
                        <div className="h-3 w-20 rounded-full bg-white/10" />
                      </div>
                      <div className="h-4 w-12 rounded-full bg-white/10" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : filteredScoreboard.length === 0 ? (
            <div className="rounded-3xl border border-white/5 bg-[color:var(--bp-surface)] px-6 py-8 text-sm text-[color:var(--bp-text)]">
              <p>No picks yet for this show.</p>
              <p className="mt-2 text-[color:var(--bp-muted)]">
                Be the first to make picks and start the leaderboard.
              </p>
              <Link
                className="mt-5 inline-flex h-10 items-center justify-center rounded-full border border-[color:var(--bp-gold-30)] px-4 text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--bp-gold)] transition hover:border-[color:var(--bp-gold)]"
                href="/picks"
              >
                Make picks
              </Link>
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-[color:var(--bp-gold-30)] bg-[color:var(--bp-surface-2)] px-6 py-4 shadow-[0_12px_36px_rgba(0,0,0,0.45),0_0_24px_rgba(198,162,74,0.35)]">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-[color:var(--bp-gold)]">
                  <span>Current leader</span>
                  <span className="text-lg font-semibold text-[color:var(--bp-gold)]">
                    {topThree[0]?.points ?? 0} pts
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <img
                      src={avatarSrcForKey(topThree[0]?.avatar_key ?? null)}
                      alt={topThree[0]?.display_name ?? "Leader"}
                      className="h-16 w-16 rounded-3xl border border-[color:var(--bp-gold-30)] bg-black/40"
                      loading="lazy"
                    />
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--bp-dim)]">
                        Leader
                      </p>
                      <p className="text-2xl font-semibold text-[color:var(--bp-text)] sm:text-3xl">
                        {topThree[0]?.display_name ?? "TBD"}
                      </p>
                      {currentUserId && topThree[0]?.user_id === currentUserId ? (
                        <p className="mt-1 text-sm text-[color:var(--bp-muted)]">
                          You are in the lead.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative flex flex-row items-end justify-center">
                {[1, 0, 2]
                  .filter((index) => index < topThree.length)
                  .map((rankIndex) => {
                    const row = topThree[rankIndex];
                    const delta = rankDelta[row.user_id];
                    const hasDelta = delta !== null && delta !== undefined && delta !== 0;
                    const borderColor =
                      rankIndex === 0
                        ? "border-[color:var(--bp-gold-30)]"
                        : rankIndex === 1
                        ? "border-[color:var(--bp-silver)]/40"
                        : "border-[color:var(--bp-bronze)]/40";
                    const badgeColor =
                      rankIndex === 0
                        ? "bg-[color:var(--bp-gold)] text-black"
                        : rankIndex === 1
                        ? "bg-[color:var(--bp-silver)] text-black"
                        : "bg-[color:var(--bp-bronze)] text-black";
                    return (
                      <Link
                        key={row.id}
                        className={`group relative w-full border ${borderColor} bg-[color:var(--bp-bg)] px-4 py-4 transition hover:border-[color:var(--bp-gold)] ${
                          rankIndex === 0
                            ? "z-20 -translate-y-4 -mb-6 scale-[1.08] pb-8 sm:-translate-y-6 sm:-mb-8 sm:scale-[1.1] sm:pb-10 md:scale-[1.12] md:px-5 md:py-5"
                            : "z-10"
                        } ${
                          rankIndex === 1
                            ? "-mr-6 sm:-mr-8 md:-mr-10"
                            : rankIndex === 2
                            ? "-ml-6 sm:-ml-8 md:-ml-10"
                            : ""
                        } ${rankIndex === 0 ? "rounded-3xl" : "rounded-none"} max-w-[10rem] sm:max-w-[11.5rem] md:max-w-[13.5rem]`}
                        href={`/scoreboard/${row.user_id}?show=${row.show_id}`}
                      >
                        <div className="flex flex-col items-center text-center">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${badgeColor}`}
                          >
                            {rankIndex + 1}
                          </span>
                          <div
                            className={`mt-3 flex w-full items-center gap-3 ${
                              hasDelta ? "justify-between" : "justify-center"
                            }`}
                          >
                            <img
                              src={avatarSrcForKey(row.avatar_key)}
                              alt={row.display_name}
                              className="h-10 w-10 rounded-2xl border border-white/10 bg-black/40"
                              loading="lazy"
                            />
                            {hasDelta ? <MovementPill delta={delta ?? null} /> : null}
                          </div>
                        </div>
                        <div className="mt-3 min-w-0 text-center">
                          <p className="truncate text-base font-semibold text-[color:var(--bp-text)]">
                            {row.display_name}
                          </p>
                          <p className="text-sm text-[color:var(--bp-muted)]">
                            {row.points} pts
                          </p>
                        </div>
                      </Link>
                    );
                  })}
              </div>

              <div className="rounded-3xl border border-white/5 bg-[color:var(--bp-surface)]">
                <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--bp-muted)]">
                    Standings
                  </p>
                </div>
                <div className="divide-y divide-white/5">
                  {filteredScoreboard.slice(3).map((row, index) => {
                    const delta = rankDelta[row.user_id];
                    const isCurrentUser = currentUserId === row.user_id;
                    return (
                      <Link
                        key={row.id}
                        className={`group flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition hover:bg-white/5 ${
                          isCurrentUser
                            ? "border-l-4 border-[color:var(--bp-gold)] bg-[color:var(--bp-gold-15)]"
                            : ""
                        }`}
                        href={`/scoreboard/${row.user_id}?show=${row.show_id}`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-1">
                          <span className="w-10 shrink-0 text-lg font-semibold text-[color:var(--bp-gold)]">
                            {index + 4}
                          </span>
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <img
                              src={avatarSrcForKey(row.avatar_key)}
                              alt={row.display_name}
                              className="h-10 w-10 shrink-0 rounded-2xl border border-white/10 bg-black/40"
                              loading="lazy"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold text-[color:var(--bp-text)]">
                                {row.display_name}
                                {isCurrentUser && (
                                  <span className="ml-2 inline-flex items-center rounded-full border border-[color:var(--bp-gold-30)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-[color:var(--bp-gold)]">
                                    You
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-[color:var(--bp-dim)]">
                                Updated{" "}
                                {new Date(row.updated_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <MovementPill delta={delta ?? null} />
                          <p className="text-lg font-semibold text-[color:var(--bp-text)]">
                            {row.points}
                            <span className="ml-1 text-xs text-[color:var(--bp-dim)]">
                              pts
                            </span>
                          </p>
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--bp-gold-30)] text-[color:var(--bp-gold)] transition group-hover:border-[color:var(--bp-gold)]">
                            <span className="text-base leading-none">›</span>
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </section>
      </main>
      <style jsx global>{`
        @keyframes bp-score-pulse {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(0%);
          }
        }
      `}</style>
    </div>
  );
}
