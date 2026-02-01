"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  show_id: string | null;
  payload: {
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
    match_picks?: Record<string, string | null>;
    match_finish_picks?: Record<
      string,
      { method: string | null; winner: string | null; loser: string | null }
    >;
  };
  updated_at: string;
};

type ShowRow = {
  id: string;
  name: string;
};

type EventRow = {
  id: string;
  name: string;
  show_id: string | null;
  rumble_gender: string | null;
  iron_person_entrant_id?: string | null;
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

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_key: string | null;
};

type ScoreboardRow = ScoreRow & { display_name: string; avatar_key: string | null };

const SCOREBOARD_POLL_INTERVAL_MS = 30000;

export default function ScoreboardPage() {
  const searchParams = useSearchParams();
  const queryShowId = searchParams.get("show");
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedShowId, setSelectedShowId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rumbleEntries, setRumbleEntries] = useState<RumbleEntryRow[]>([]);
  const [eventEntrants, setEventEntrants] = useState<EventEntrantRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchSides, setMatchSides] = useState<MatchSideRow[]>([]);
  const [matchEntrants, setMatchEntrants] = useState<MatchEntrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [rankDelta, setRankDelta] = useState<Record<string, number | null>>({});
  const previousRanksRef = useRef<Record<string, number>>({});
  const lastDeltaRef = useRef<Record<string, number>>({});
  const [lastUpdateAt, setLastUpdateAt] = useState(Date.now());
  const [progressOpen, setProgressOpen] = useState(false);
  const loadScoresRef = useRef<() => void>(() => {});
  const loadRumbleEntriesRef = useRef<() => void>(() => {});

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
    () => events.filter((event) => event.show_id === selectedShowId),
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
      if (!match.winner_side_id || !match.finish_method) return false;
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
      pick: PickRow["payload"]["rumbles"][string] | undefined,
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
      .select("id, user_id, show_id, payload, updated_at")
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
      const rumbles = pick.payload?.rumbles ?? {};
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
        match_picks: pick.payload?.match_picks ?? {},
        match_finish_picks: pick.payload?.match_finish_picks ?? {},
      };
      const matchScore = calculateScore(
        matchPayload,
        [],
        scoringRules,
        matches,
        matchEntrants,
        matchSides
      );
      points += matchScore.points;
      breakdown.matches = matchScore.breakdown.matches ?? 0;
      breakdown.match_finish_method = matchScore.breakdown.match_finish_method ?? 0;

      return {
        id: pick.id,
        user_id: pick.user_id,
        show_id: pick.show_id,
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
      const { data: showRows, error: showError } = await supabase
        .from("shows")
        .select("id, name")
        .order("starts_at", { ascending: true });
      if (showError) {
        setMessage(showError.message);
        return;
      }
      setShows(showRows ?? []);
      if (showRows && showRows.length > 0) {
        const defaultId =
          queryShowId && showRows.some((show) => show.id === queryShowId)
            ? queryShowId
            : showRows[0].id;
        setSelectedShowId((current) => current || defaultId);
      }
    };

    const loadEvents = async () => {
      const { data: eventRows, error } = await supabase
        .from("events")
        .select("id, name, show_id, rumble_gender, iron_person_entrant_id")
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
    previousRanksRef.current = {};
    setRankDelta({});
    lastDeltaRef.current = {};
  }, [selectedShowId]);

  useEffect(() => {
    if (!selectedShowId) {
      return;
    }

    loadRumbleEntriesRef.current();
    loadScoresRef.current();
    setLastUpdateAt(Date.now());

    const interval = setInterval(() => {
      setLastUpdateAt(Date.now());
      loadScoresRef.current();
      loadRumbleEntriesRef.current();
    }, SCOREBOARD_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [selectedShowId, showEvents]);

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
          "id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id"
        )
        .eq("show_id", selectedShowId)
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <ScoreboardCountdown
        className="px-6 sm:pb-[calc(env(safe-area-inset-bottom,0px)+6px)]"
        intervalMs={SCOREBOARD_POLL_INTERVAL_MS}
        lastUpdateAt={lastUpdateAt}
        tickerItems={eventProgressItems}
        onTickerClick={() => setProgressOpen(true)}
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
      <main className="mx-auto w-full max-w-5xl pb-10 pt-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Scoreboard</h1>
          <p className="text-sm text-zinc-400">
            Scores update as eliminations and results are recorded.
          </p>
        </header>
        {shows.length > 0 && (
          <div className="mt-6">
            <label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Show
              <select
                className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                value={selectedShowId}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedShowId(value);
                  const url = new URL(window.location.href);
                  url.searchParams.set("show", value);
                  window.history.replaceState({}, "", url.toString());
                }}
                disabled={shows.length === 1}
              >
                {shows.map((show) => (
                  <option key={show.id} value={show.id}>
                    {show.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/50 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          {currentUserIndex !== null && (
            <div className="mb-6 rounded-2xl border border-sky-400/40 bg-sky-400/5 px-4 py-3 text-sm text-sky-100">
              You are currently <span className="font-semibold">#{currentUserIndex + 1}</span> in this show.
            </div>
          )}
          {loading ? (
            <p className="text-sm text-zinc-400">Loading scoreboard…</p>
          ) : filteredScoreboard.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-6 text-sm text-zinc-300">
              <p>No picks yet for this show.</p>
              <p className="mt-2 text-zinc-400">
                Be the first to make picks and start the leaderboard.
              </p>
              <Link
                className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                href="/picks"
              >
                Make picks
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                {topThree.map((row, index) => {
                  const delta = rankDelta[row.user_id];
                  return (
                  <Link
                    key={row.id}
                    className={`group rounded-2xl border px-4 py-4 transition hover:text-amber-200 ${
                      index === 0
                        ? "border-amber-400/60 bg-amber-400/10"
                        : "border-zinc-800 bg-zinc-950/50"
                    }`}
                    href={`/scoreboard/${row.user_id}?show=${row.show_id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-3xl font-semibold text-amber-300">
                        #{index + 1}
                        {typeof delta === "number" && delta !== 0 && (
                          <span
                            className={`text-xs font-semibold uppercase tracking-wide ${
                              delta > 0
                                ? "text-emerald-300"
                                : "text-rose-300"
                            }`}
                          >
                            {delta > 0
                              ? `▲ ${Math.abs(delta)}`
                              : `▼ ${Math.abs(delta)}`}
                          </span>
                        )}
                      </span>
                      {index === 0 && showResultsComplete && (
                        <span className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-amber-200">
                          <svg
                            className="h-10 w-10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <rect x="2" y="8" width="20" height="8" rx="3" />
                            <rect x="9" y="6" width="6" height="12" rx="2" />
                            <circle cx="12" cy="12" r="2.5" />
                          </svg>
                          Champion
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <img
                        src={avatarSrcForKey(row.avatar_key)}
                        alt={row.display_name}
                        className="h-10 w-10 rounded-2xl border border-zinc-800 bg-black/40"
                        loading="lazy"
                      />
                      <p className="text-lg font-semibold">{row.display_name}</p>
                      <span className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/60 bg-black text-amber-200 transition group-hover:border-amber-300 group-hover:text-amber-100">
                        <span className="text-base leading-none">›</span>
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-400">
                      {row.points} points
                    </p>
                  </Link>
                );
                })}
              </div>

              <div className="divide-y divide-zinc-800">
                {filteredScoreboard.slice(3).map((row, index) => {
                  const delta = rankDelta[row.user_id];
                  const content = (
                    <>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-2 text-lg font-semibold text-amber-300">
                          #{index + 4}
                          {typeof delta === "number" && delta !== 0 && (
                            <span
                              className={`text-xs font-semibold uppercase tracking-wide ${
                                delta > 0 ? "text-emerald-300" : "text-rose-300"
                              }`}
                            >
                              {delta > 0
                                ? `▲ ${Math.abs(delta)}`
                                : `▼ ${Math.abs(delta)}`}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-3">
                          <img
                            src={avatarSrcForKey(row.avatar_key)}
                            alt={row.display_name}
                            className="h-9 w-9 rounded-2xl border border-zinc-800 bg-black/40"
                            loading="lazy"
                          />
                          <div>
                            <p className="text-base font-semibold">
                              {row.display_name}
                            </p>
                            <p className="text-xs text-zinc-400">
                              Updated{" "}
                              {new Date(row.updated_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                            <div className="mt-1 text-left">
                              <p className="text-lg font-semibold">
                                {row.points}
                              </p>
                              <p className="text-[10px] text-zinc-500">points</p>
                            </div>
                            {currentUserId === row.user_id && (
                              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                                You
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  );

                const rowClassName = `group flex flex-col gap-2 py-4 transition sm:flex-row sm:items-center sm:justify-between ${
                  index % 2 === 0 ? "bg-zinc-950/40" : "bg-zinc-900/30"
                } ${
                  currentUserId === row.user_id
                    ? "border border-sky-400/50 bg-sky-400/5"
                    : ""
                } hover:bg-amber-500/5`;

                if (!row.show_id) {
                  return (
                    <div
                      key={row.id}
                      className={rowClassName}
                    >
                      {content}
                    </div>
                  );
                }

                return (
                  <Link
                    key={row.id}
                    className={`${rowClassName} hover:text-amber-200`}
                    href={`/scoreboard/${row.user_id}?show=${row.show_id}`}
                  >
                    {content}
                    <span className="mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/60 bg-black text-amber-200 transition group-hover:border-amber-300 group-hover:text-amber-100 sm:mt-0 sm:ml-6 sm:self-auto self-end">
                      <span className="text-base leading-none">›</span>
                    </span>
                  </Link>
                );
              })}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
