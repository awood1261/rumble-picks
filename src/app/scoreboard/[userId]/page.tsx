"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { EntrantCard } from "../../../components/EntrantCard";
import { scoringRules } from "../../../lib/scoringRules";

type RumblePick = {
  entrants: string[];
  final_four: string[];
  winner: string | null;
  entry_1: string | null;
  entry_2: string | null;
  entry_30: string | null;
  iron_person: string | null;
  most_eliminations: string | null;
};

type PicksPayload = {
  rumbles: Record<string, RumblePick>;
  eliminators?: Record<
    string,
    {
      entry_order?: Record<string, number | null>;
      elimination_order?: Record<string, number | null>;
      elimination_type?: Record<string, "pinfall" | "submission" | null>;
      winner_id?: string | null;
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
};

type EntrantRow = {
  id: string;
  name: string;
  promotion: string | null;
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

type ShowRow = {
  id: string;
  name: string;
  tagline?: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type RumbleEntryRow = {
  event_id: string;
  entrant_id: string;
  entry_number: number | null;
  eliminated_at: string | null;
  eliminations_count: number;
  is_confirmed?: boolean;
};

type EliminatorRow = {
  id: string;
  name: string;
  show_id: string | null;
  entrant_limit: number;
  order_index?: number | null;
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

type MatchRow = {
  id: string;
  name: string;
  kind: string;
  winner_entrant_id: string | null;
  winner_side_id: string | null;
  finish_method: string | null;
  finish_winner_entrant_id: string | null;
  finish_loser_entrant_id: string | null;
  match_length?: string | null;
  match_interference?: string | null;
  order_index?: number | null;
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

const PICKS_POLL_INTERVAL_MS = 120000;

const emptyRumblePick: RumblePick = {
  entrants: [],
  final_four: [],
  winner: null,
  entry_1: null,
  entry_2: null,
  entry_30: null,
  iron_person: null,
  most_eliminations: null,
};

const emptyEliminatorPick = {
  entry_order: {},
  elimination_order: {},
  elimination_type: {},
  winner_id: null,
  most_eliminations: null,
};

type EventActuals = {
  entrantSet: Set<string>;
  confirmedSet: Set<string>;
  finalFourSet: Set<string>;
  winner: string | null;
  entry1: string | null;
  entry2: string | null;
  entry30: string | null;
  ironPerson: string | null;
  topElims: Set<string>;
  hasData: boolean;
  totalEntries: number;
  remainingCount: number;
  finalFourReady: boolean;
  winnerReady: boolean;
  entry1Ready: boolean;
  entry2Ready: boolean;
  entry30Ready: boolean;
  ironPersonReady: boolean;
  mostElimsReady: boolean;
};

const emptyActuals: EventActuals = {
  entrantSet: new Set<string>(),
  confirmedSet: new Set<string>(),
  finalFourSet: new Set<string>(),
  winner: null,
  entry1: null,
  entry2: null,
  entry30: null,
  ironPerson: null,
  topElims: new Set<string>(),
  hasData: false,
  totalEntries: 0,
  remainingCount: 0,
  finalFourReady: false,
  winnerReady: false,
  entry1Ready: false,
  entry2Ready: false,
  entry30Ready: false,
  ironPersonReady: false,
  mostElimsReady: false,
};

export default function ScoreboardPicksPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawUserId = params.userId;
  const userId =
    typeof rawUserId === "string"
      ? rawUserId
      : Array.isArray(rawUserId)
        ? rawUserId[0] ?? ""
        : "";
  const showId = searchParams.get("show");
  const validShowId =
    showId && showId !== "undefined" && showId !== "null" ? showId : null;

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<PicksPayload | null>(null);
  const [entrants, setEntrants] = useState<EntrantRow[]>([]);
  const [rumbleEntries, setRumbleEntries] = useState<RumbleEntryRow[]>([]);
  const [eliminators, setEliminators] = useState<EliminatorRow[]>([]);
  const [eliminatorEntries, setEliminatorEntries] = useState<
    EliminatorEntryRow[]
  >([]);
  const [eliminatorEliminations, setEliminatorEliminations] = useState<
    EliminatorEliminationRow[]
  >([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchSides, setMatchSides] = useState<MatchSideRow[]>([]);
  const [matchEntrants, setMatchEntrants] = useState<MatchEntrantRow[]>([]);
  const [matchPickStats, setMatchPickStats] = useState<
    Record<string, { total: number; bySide: Record<string, number> }>
  >({});
  const [show, setShow] = useState<ShowRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [rankInfo, setRankInfo] = useState<{ rank: number | null; total: number }>(
    { rank: null, total: 0 }
  );

  const entrantMap = useMemo(() => {
    return new Map(entrants.map((entrant) => [entrant.id, entrant]));
  }, [entrants]);

  const matchSidesByMatch = useMemo(() => {
    return matchSides.reduce((map, side) => {
      if (!map[side.match_id]) {
        map[side.match_id] = [];
      }
      map[side.match_id].push(side);
      return map;
    }, {} as Record<string, MatchSideRow[]>);
  }, [matchSides]);

  const matchEntrantsByMatch = useMemo(() => {
    return matchEntrants.reduce((map, row) => {
      if (!map[row.match_id]) {
        map[row.match_id] = [];
      }
      map[row.match_id].push(row);
      return map;
    }, {} as Record<string, MatchEntrantRow[]>);
  }, [matchEntrants]);

  const matchWinnerMap = useMemo(() => {
    return new Map(matches.map((match) => [match.id, match.winner_side_id]));
  }, [matches]);

  const renderGhostStrip = (ids: string[], maxVisible = 3) => {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return null;
    const visible = uniqueIds.slice(0, maxVisible);
    return (
      <div className="pointer-events-none absolute inset-0 z-0 flex items-stretch justify-end -space-x-6 overflow-hidden opacity-60 transition-opacity duration-300">
        {visible.map((id) => {
          const entrant = entrantMap.get(id);
          const name = entrant?.name ?? "Unknown";
          return (
            <div
              key={id}
              className="relative h-full w-20 overflow-hidden rounded-none border-l border-zinc-800 bg-gradient-to-b from-amber-400/40 via-zinc-900 to-zinc-950 shadow-sm sm:w-28"
              title={name}
            >
              {entrant?.image_url ? (
                <img
                  src={entrant.image_url}
                  alt={name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="h-full w-full" />
              )}
            </div>
          );
        })}
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-zinc-950/35 to-zinc-950" />
      </div>
    );
  };

  const ChevronIcon = () => (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );

  const getEliminationKey = (entry: RumbleEntryRow) =>
    entry.eliminated_at ? new Date(entry.eliminated_at).getTime() : Number.MAX_SAFE_INTEGER;

  const actualsByEvent = useMemo(() => {
    const byEvent: Record<string, EventActuals> = {};
    events.forEach((event) => {
      const eventEntries = rumbleEntries.filter(
        (entry) => entry.event_id === event.id
      );
      const confirmedSet = new Set(
        eventEntries.filter((entry) => entry.is_confirmed).map((entry) => entry.entrant_id)
      );
      const entrantSet = new Set(
        eventEntries
          .filter((entry) => !entry.is_confirmed)
          .map((entry) => entry.entrant_id)
      );
      const finalFour = [...eventEntries]
        .sort((a, b) => getEliminationKey(b) - getEliminationKey(a))
        .slice(0, 4)
        .map((entry) => entry.entrant_id);
      const winners = eventEntries.filter((entry) => !entry.eliminated_at);
      const totalEntries = eventEntries.length;
      const remainingCount = winners.length;
      const finalFourReady = totalEntries >= 4 && remainingCount <= 4;
      const winnerReady = totalEntries >= 30 && remainingCount === 1;
      const winner =
        winnerReady
          ? winners[0].entrant_id
          : null;
      const entry1 =
        eventEntries.find((entry) => entry.entry_number === 1)?.entrant_id ??
        null;
      const entry2 =
        eventEntries.find((entry) => entry.entry_number === 2)?.entrant_id ??
        null;
      const entry30 =
        eventEntries.find((entry) => entry.entry_number === 30)?.entrant_id ??
        null;
      const entry1Ready = Boolean(entry1);
      const entry2Ready = Boolean(entry2);
      const entry30Ready = Boolean(entry30);
      const ironPerson =
        winnerReady
          ? event.iron_person_entrant_id ??
            [...eventEntries]
              .filter((entry) => entry.eliminated_at)
              .sort(
                (a, b) =>
                  new Date(b.eliminated_at as string).getTime() -
                  new Date(a.eliminated_at as string).getTime()
              )[0]?.entrant_id ?? null
          : null;
      const ironPersonReady = Boolean(ironPerson);
      const mostElimsReady = totalEntries >= 30 && remainingCount === 1;
      const maxElims = eventEntries.reduce(
        (max, entry) => Math.max(max, entry.eliminations_count ?? 0),
        0
      );
      const topElims = new Set(
        eventEntries
          .filter((entry) => entry.eliminations_count === maxElims)
          .map((entry) => entry.entrant_id)
      );

      byEvent[event.id] = {
        entrantSet,
        confirmedSet,
        finalFourSet: finalFourReady ? new Set(finalFour) : new Set(),
        winner,
        entry1,
        entry2,
        entry30,
        ironPerson,
        topElims: mostElimsReady ? topElims : new Set(),
        hasData: totalEntries > 0,
        totalEntries,
        remainingCount,
        finalFourReady,
        winnerReady,
        entry1Ready,
        entry2Ready,
        entry30Ready,
        ironPersonReady,
        mostElimsReady,
      };
    });

    return byEvent;
  }, [events, rumbleEntries]);

  const eventPointsByEvent = useMemo(() => {
    const map: Record<
      string,
      { entrants: number; finalFour: number; keyPicks: number; total: number }
    > = {};
    events.forEach((event) => {
      const pick = payload?.rumbles?.[event.id] ?? emptyRumblePick;
      const actuals = actualsByEvent[event.id] ?? emptyActuals;
      if (!actuals.hasData) {
        map[event.id] = { entrants: 0, finalFour: 0, keyPicks: 0, total: 0 };
        return;
      }
      const entrantsCorrect = pick.entrants.filter((id) =>
        actuals.entrantSet.has(id)
      ).length;
      const finalFourCorrect = actuals.finalFourReady
        ? pick.final_four.filter((id) => actuals.finalFourSet.has(id)).length
        : 0;
      const keyPicks =
        (actuals.winnerReady &&
        pick.winner &&
        pick.winner === actuals.winner
          ? scoringRules.winner
          : 0) +
        (actuals.entry1Ready &&
        pick.entry_1 &&
        pick.entry_1 === actuals.entry1
          ? scoringRules.entry_1
          : 0) +
        (actuals.entry2Ready &&
        pick.entry_2 &&
        pick.entry_2 === actuals.entry2
          ? scoringRules.entry_2
          : 0) +
        (actuals.entry30Ready &&
        pick.entry_30 &&
        pick.entry_30 === actuals.entry30
          ? scoringRules.entry_30
          : 0) +
        (actuals.ironPersonReady &&
        pick.iron_person &&
        pick.iron_person === actuals.ironPerson
          ? scoringRules.iron_person
          : 0) +
        (actuals.mostElimsReady &&
        pick.most_eliminations &&
        actuals.topElims.has(pick.most_eliminations)
          ? scoringRules.most_eliminations
          : 0);
      const entrantsPoints = entrantsCorrect * scoringRules.entrants;
      const finalFourPoints = actuals.finalFourReady
        ? finalFourCorrect * scoringRules.final_four
        : 0;
      map[event.id] = {
        entrants: entrantsPoints,
        finalFour: finalFourPoints,
        keyPicks:
          actuals.winnerReady ||
          actuals.entry1Ready ||
          actuals.entry2Ready ||
          actuals.entry30Ready ||
          actuals.ironPersonReady ||
          actuals.mostElimsReady
            ? keyPicks
            : 0,
        total: entrantsPoints + finalFourPoints + keyPicks,
      };
    });
    return map;
  }, [actualsByEvent, events, payload]);

  const eventPointsSummary = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        const points = eventPointsByEvent[event.id] ?? {
          entrants: 0,
          finalFour: 0,
          keyPicks: 0,
          total: 0,
        };
        acc.entrants += points.entrants;
        acc.finalFour += points.finalFour;
        acc.keyPicks += points.keyPicks;
        acc.total += points.total;
        return acc;
      },
      { entrants: 0, finalFour: 0, keyPicks: 0, total: 0 }
    );
  }, [eventPointsByEvent, events]);

  const eliminatorPointsById = useMemo(() => {
    const map: Record<
      string,
      {
        entryOrder: number;
        eliminationOrder: number;
        eliminationType: number;
        mostElims: number;
        total: number;
      }
    > = {};
    eliminators.forEach((eliminator) => {
      const entries = eliminatorEntries.filter(
        (entry) => entry.eliminator_id === eliminator.id
      );
      const eliminations = eliminatorEliminations.filter(
        (entry) => entry.eliminator_id === eliminator.id
      );
      const pick = payload?.eliminators?.[eliminator.id];
      const entryReady = entries.length > 0 && entries.every((entry) => entry.entry_order);
      const eliminationReady =
        eliminations.length === Math.max(entries.length - 1, 0);
      let entryOrder = 0;
      let eliminationOrder = 0;
      let eliminationType = 0;
      let mostElims = 0;
      if (pick && entryReady) {
        const orderMap = pick.entry_order ?? {};
        entries.forEach((entry) => {
          if (entry.entry_order && orderMap[entry.entrant_id] === entry.entry_order) {
            entryOrder += scoringRules.eliminator_entry_order;
          }
        });
      }
      if (pick && eliminationReady) {
        const elimOrderMap = pick.elimination_order ?? {};
        const elimTypeMap = pick.elimination_type ?? {};
        eliminations.forEach((entry) => {
          if (elimOrderMap[entry.eliminated_entrant_id] === entry.elimination_order) {
            eliminationOrder += scoringRules.eliminator_elimination_order;
          }
          if (elimTypeMap[entry.eliminated_entrant_id] === entry.elimination_type) {
            eliminationType += scoringRules.eliminator_elimination_type;
          }
        });
        if (pick.most_eliminations) {
          const eliminationsByEntrant = eliminations.reduce((acc, row) => {
            if (!row.eliminated_by_entrant_id) return acc;
            acc[row.eliminated_by_entrant_id] =
              (acc[row.eliminated_by_entrant_id] ?? 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          const maxElims = Math.max(0, ...Object.values(eliminationsByEntrant));
          const topElims = Object.keys(eliminationsByEntrant).filter(
            (id) => eliminationsByEntrant[id] === maxElims
          );
          if (topElims.includes(pick.most_eliminations)) {
            mostElims = scoringRules.eliminator_most_eliminations;
          }
        }
      }
      map[eliminator.id] = {
        entryOrder,
        eliminationOrder,
        eliminationType,
        mostElims,
        total: entryOrder + eliminationOrder + eliminationType + mostElims,
      };
    });
    return map;
  }, [eliminators, eliminatorEntries, eliminatorEliminations, payload]);

  const eliminatorPointsSummary = useMemo(() => {
    return eliminators.reduce(
      (acc, eliminator) => acc + (eliminatorPointsById[eliminator.id]?.total ?? 0),
      0
    );
  }, [eliminators, eliminatorPointsById]);

  const matchPointsSummary = useMemo(() => {
    const summary = {
      winner: 0,
      finishMethod: 0,
      finishWinner: 0,
      finishLoser: 0,
      matchLength: 0,
      matchInterference: 0,
      total: 0,
    };
    const entrantCountByMatch = matchEntrants.reduce((map, row) => {
      map[row.match_id] = (map[row.match_id] ?? 0) + 1;
      return map;
    }, {} as Record<string, number>);
    matches.forEach((match) => {
      const pick = payload?.match_picks?.[match.id] ?? null;
      if (match.winner_side_id && pick && pick === match.winner_side_id) {
        summary.winner += scoringRules.match_winner;
      }
      const lengthPick = payload?.match_length_picks?.[match.id] ?? null;
      if (match.match_length && lengthPick === match.match_length) {
        summary.matchLength += scoringRules.match_length;
      }
      const interferencePick = payload?.match_interference_picks?.[match.id] ?? null;
      if (match.match_interference && interferencePick === match.match_interference) {
        summary.matchInterference += scoringRules.match_interference;
      }
      const entrantCount = entrantCountByMatch[match.id] ?? 0;
      if (!match.finish_method) {
        return;
      }
      const finishPick = payload?.match_finish_picks?.[match.id];
      if (!finishPick) return;
      if (finishPick.method && finishPick.method === match.finish_method) {
        summary.finishMethod += scoringRules.match_finish_method;
        if (
          (match.finish_method === "pinfall" ||
            match.finish_method === "submission") &&
          finishPick.method === match.finish_method &&
          entrantCount > 2
        ) {
          if (
            match.finish_winner_entrant_id &&
            finishPick.winner === match.finish_winner_entrant_id
          ) {
            summary.finishWinner += scoringRules.match_finish_winner;
          }
          if (
            match.finish_loser_entrant_id &&
            finishPick.loser === match.finish_loser_entrant_id
          ) {
            summary.finishLoser += scoringRules.match_finish_loser;
          }
        }
      }
    });
    summary.total =
      summary.winner +
      summary.finishMethod +
      summary.finishWinner +
      summary.finishLoser +
      summary.matchLength +
      summary.matchInterference;
    return summary;
  }, [matchEntrants, matches, payload]);

  const totalShowPoints = useMemo(() => {
    return (
      eventPointsSummary.total +
      matchPointsSummary.total +
      eliminatorPointsSummary
    );
  }, [eventPointsSummary.total, matchPointsSummary.total, eliminatorPointsSummary]);

  const load = useCallback(async () => {
    if (!validShowId) {
      setMessage("Missing show id.");
      setLoading(false);
      return;
    }
    const [
      { data: pickRow, error: pickError },
      { data: showRow },
      { data: eventRows },
      { data: profileRow },
      { data: matchRows, error: matchError },
      { data: eliminatorRows, error: eliminatorError },
      { data: allPickRows, error: allPickError },
      { data: scoreRows, error: scoreError },
    ] = await Promise.all([
      supabase
        .from("picks")
        .select(
          "rumbles:payload->rumbles, eliminators:payload->eliminators, match_picks:payload->match_picks, match_finish_picks:payload->match_finish_picks, match_length_picks:payload->match_length_picks, match_interference_picks:payload->match_interference_picks"
        )
        .eq("show_id", validShowId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("shows")
        .select("id, name, image_url, promotion_id, status, starts_at")
        .eq("id", validShowId)
        .maybeSingle(),
      supabase
        .from("events")
        .select("id, name, show_id, rumble_gender, iron_person_entrant_id, order_index")
        .eq("show_id", validShowId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, display_name")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("matches")
        .select(
          "id, name, kind, order_index, winner_entrant_id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id, match_length, match_interference"
        )
        .eq("show_id", validShowId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("eliminators")
        .select("id, name, show_id, entrant_limit, order_index")
        .eq("show_id", validShowId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true }),
      supabase
        .from("picks")
        .select("match_picks:payload->match_picks")
        .eq("show_id", validShowId),
      supabase
        .from("scores")
        .select("user_id, points")
        .eq("show_id", validShowId),
    ]);

    if (pickError) {
      setMessage(pickError.message);
      setLoading(false);
      return;
    }
    if (scoreError) {
      setMessage(scoreError.message);
      setLoading(false);
      return;
    }
    if (allPickError) {
      setMessage(allPickError.message);
      setLoading(false);
      return;
    }
    if (eliminatorError) {
      setMessage(eliminatorError.message);
      setLoading(false);
      return;
    }

    const eventList = ((eventRows ?? []) as EventRow[]).sort(
      (a, b) =>
        (a.order_index ?? 9999) - (b.order_index ?? 9999) ||
        a.name.localeCompare(b.name)
    );
    const nextPayload = pickRow
      ? ({
          rumbles: pickRow.rumbles ?? {},
          eliminators: pickRow.eliminators ?? {},
          match_picks: pickRow.match_picks ?? {},
          match_finish_picks: pickRow.match_finish_picks ?? {},
          match_length_picks: pickRow.match_length_picks ?? {},
          match_interference_picks: pickRow.match_interference_picks ?? {},
        } as PicksPayload)
      : null;
    setPayload(nextPayload);
    setShow(showRow ?? null);
    setEvents(eventList);
    setProfile(profileRow ?? null);
    const eliminatorList = ((eliminatorRows ?? []) as EliminatorRow[]).sort(
      (a, b) =>
        (a.order_index ?? 9999) - (b.order_index ?? 9999) ||
        a.name.localeCompare(b.name)
    );
    setEliminators(eliminatorList);
    const nextStats: Record<string, { total: number; bySide: Record<string, number> }> = {};
    (allPickRows ?? []).forEach((row) => {
      const matchPicks =
        (row as { match_picks?: Record<string, string | null> })
          .match_picks ?? {};
      Object.entries(matchPicks).forEach(([matchId, sideId]) => {
        if (!sideId) return;
        if (!nextStats[matchId]) {
          nextStats[matchId] = { total: 0, bySide: {} };
        }
        nextStats[matchId].total += 1;
        nextStats[matchId].bySide[sideId] =
          (nextStats[matchId].bySide[sideId] ?? 0) + 1;
      });
    });
    setMatchPickStats(nextStats);

    const scoreList = (scoreRows ?? []) as { user_id: string; points: number }[];
    if (scoreList.length > 0) {
      const sortedScores = [...scoreList].sort((a, b) => b.points - a.points);
      const index = sortedScores.findIndex((row) => row.user_id === userId);
      setRankInfo({
        rank: index >= 0 ? index + 1 : null,
        total: sortedScores.length,
      });
    } else {
      setRankInfo({ rank: null, total: 0 });
    }

    if (eventList.length === 0) {
      setRumbleEntries([]);
    } else {
      const eventIds = eventList.map((event) => event.id);
      const { data: entryRows, error: entryError } = await supabase
        .from("rumble_entries")
        .select(
          "event_id, entrant_id, entry_number, eliminated_at, eliminations_count, is_confirmed"
        )
        .in("event_id", eventIds);
      if (entryError) {
        setMessage(entryError.message);
        setLoading(false);
        return;
      }
      setRumbleEntries((entryRows ?? []) as RumbleEntryRow[]);
    }
    const matchList = ((matchRows ?? []) as MatchRow[]).sort(
      (a, b) =>
        (a.order_index ?? 9999) - (b.order_index ?? 9999) ||
        a.name.localeCompare(b.name)
    );
    setMatches(matchList);

    if (matchError) {
      setMessage(matchError.message);
      setLoading(false);
      return;
    }

    let matchEntrantRowsList: MatchEntrantRow[] = [];
    if (matchList.length > 0) {
      const matchIds = matchList.map((match) => match.id);
      const [
        { data: matchSideRows, error: matchSideError },
        { data: matchEntrantRows, error: matchEntrantError },
      ] = await Promise.all([
        supabase
          .from("match_sides")
          .select("id, match_id, label")
          .in("match_id", matchIds),
        supabase
          .from("match_entrants")
          .select("match_id, entrant_id, side_id")
          .in("match_id", matchIds),
      ]);
      if (matchSideError) {
        setMessage(matchSideError.message);
        setLoading(false);
        return;
      }
      if (matchEntrantError) {
        setMessage(matchEntrantError.message);
        setLoading(false);
        return;
      }
      const sideRowsList = (matchSideRows ?? []) as MatchSideRow[];
      matchEntrantRowsList = (matchEntrantRows ?? []) as MatchEntrantRow[];
      setMatchSides(sideRowsList);
      setMatchEntrants(matchEntrantRowsList);
    } else {
      setMatchSides([]);
      setMatchEntrants([]);
    }

    let eliminatorEntryRowsList: EliminatorEntryRow[] = [];
    let eliminatorElimRowsList: EliminatorEliminationRow[] = [];
    if (eliminatorList.length > 0) {
      const eliminatorIds = eliminatorList.map((eliminator) => eliminator.id);
      const [
        { data: eliminatorEntryRows, error: eliminatorEntryError },
        { data: eliminatorElimRows, error: eliminatorElimError },
      ] = await Promise.all([
        supabase
          .from("eliminator_entries")
          .select("eliminator_id, entrant_id, entry_order")
          .in("eliminator_id", eliminatorIds),
        supabase
          .from("eliminator_eliminations")
          .select(
            "eliminator_id, eliminated_entrant_id, eliminated_by_entrant_id, elimination_type, elimination_order"
          )
          .in("eliminator_id", eliminatorIds),
      ]);
      if (eliminatorEntryError) {
        setMessage(eliminatorEntryError.message);
        setLoading(false);
        return;
      }
      if (eliminatorElimError) {
        setMessage(eliminatorElimError.message);
        setLoading(false);
        return;
      }
      eliminatorEntryRowsList = (eliminatorEntryRows ?? []) as EliminatorEntryRow[];
      eliminatorElimRowsList = (eliminatorElimRows ?? []) as EliminatorEliminationRow[];
      setEliminatorEntries(eliminatorEntryRowsList);
      setEliminatorEliminations(eliminatorElimRowsList);
    } else {
      setEliminatorEntries([]);
      setEliminatorEliminations([]);
    }

    const matchFinishIds = Object.values(
      nextPayload?.match_finish_picks ?? {}
    )
      .flatMap((pick) => [pick?.winner, pick?.loser])
      .filter(Boolean);
    const matchEntrantIds = matchEntrantRowsList
      .map((row) => row.entrant_id)
      .filter(Boolean);
    const eliminatorPickIds = Object.values(
      nextPayload?.eliminators ?? {}
    ).flatMap((pick) => [
      ...Object.keys(pick?.entry_order ?? {}),
      ...Object.keys(pick?.elimination_order ?? {}),
      ...Object.keys(pick?.elimination_type ?? {}),
      pick?.winner_id,
      pick?.most_eliminations,
    ]);
    const eliminatorEntrantIds = eliminatorEntryRowsList
      .map((row) => row.entrant_id)
      .filter(Boolean);
    const rumblePickIds = Object.values(nextPayload?.rumbles ?? {}).flatMap(
      (rumble) => [
        ...(rumble?.entrants ?? []),
        ...(rumble?.final_four ?? []),
        rumble?.winner,
        rumble?.entry_1,
        rumble?.entry_2,
        rumble?.entry_30,
        rumble?.most_eliminations,
      ]
    );
    const ids = [
      ...rumblePickIds,
      ...matchFinishIds,
      ...matchEntrantIds,
      ...eliminatorPickIds,
      ...eliminatorEntrantIds,
    ]
      .filter(Boolean)
      .map(String);

    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
      setEntrants([]);
      setLoading(false);
      return;
    }

    const { data: entrantRows, error: entrantError } = await supabase
      .from("entrants")
      .select("id, name, promotion, image_url")
      .in("id", uniqueIds);

    if (entrantError) {
      setMessage(entrantError.message);
      setLoading(false);
      return;
    }

    setEntrants(entrantRows ?? []);
    setLoading(false);
  }, [validShowId, userId]);

  const loadLive = useCallback(async () => {
    if (!validShowId) {
      return;
    }
    const [
      { data: pickRow, error: pickError },
      { data: scoreRows, error: scoreError },
    ] = await Promise.all([
      supabase
        .from("picks")
        .select(
          "rumbles:payload->rumbles, eliminators:payload->eliminators, match_picks:payload->match_picks, match_finish_picks:payload->match_finish_picks, match_length_picks:payload->match_length_picks, match_interference_picks:payload->match_interference_picks"
        )
        .eq("show_id", validShowId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("scores")
        .select("user_id, points")
        .eq("show_id", validShowId),
    ]);

    if (pickError) {
      setMessage(pickError.message);
      return;
    }
    if (scoreError) {
      setMessage(scoreError.message);
      return;
    }

    const nextPayload = pickRow
      ? ({
          rumbles: pickRow.rumbles ?? {},
          eliminators: pickRow.eliminators ?? {},
          match_picks: pickRow.match_picks ?? {},
          match_finish_picks: pickRow.match_finish_picks ?? {},
          match_length_picks: pickRow.match_length_picks ?? {},
          match_interference_picks: pickRow.match_interference_picks ?? {},
        } as PicksPayload)
      : null;
    setPayload(nextPayload);

    const scoreList = (scoreRows ?? []) as { user_id: string; points: number }[];
    if (scoreList.length > 0) {
      const sortedScores = [...scoreList].sort((a, b) => b.points - a.points);
      const index = sortedScores.findIndex((row) => row.user_id === userId);
      setRankInfo({
        rank: index >= 0 ? index + 1 : null,
        total: sortedScores.length,
      });
    } else {
      setRankInfo({ rank: null, total: 0 });
    }

    if (events.length > 0) {
      const eventIds = events.map((event) => event.id);
      const { data: entryRows, error: entryError } = await supabase
        .from("rumble_entries")
        .select(
          "event_id, entrant_id, entry_number, eliminated_at, eliminations_count, is_confirmed"
        )
        .in("event_id", eventIds);
      if (entryError) {
        setMessage(entryError.message);
        return;
      }
      setRumbleEntries((entryRows ?? []) as RumbleEntryRow[]);
    }

    if (eliminators.length > 0) {
      const eliminatorIds = eliminators.map((row) => row.id);
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
    }

    const nextEntrantIds = new Set<string>();
    const payloadData = nextPayload;
    Object.values(payloadData?.rumbles ?? {}).forEach((rumble) => {
      [
        ...(rumble?.entrants ?? []),
        ...(rumble?.final_four ?? []),
        rumble?.winner,
        rumble?.entry_1,
        rumble?.entry_2,
        rumble?.entry_30,
        rumble?.iron_person,
        rumble?.most_eliminations,
      ]
        .filter(Boolean)
        .forEach((id) => nextEntrantIds.add(String(id)));
    });
    Object.values(payloadData?.match_finish_picks ?? {}).forEach((pick) => {
      [pick?.winner, pick?.loser]
        .filter(Boolean)
        .forEach((id) => nextEntrantIds.add(String(id)));
    });
    Object.values(payloadData?.eliminators ?? {}).forEach((pick) => {
      [
        ...Object.keys(pick?.entry_order ?? {}),
        ...Object.keys(pick?.elimination_order ?? {}),
        ...Object.keys(pick?.elimination_type ?? {}),
        pick?.winner_id,
        pick?.most_eliminations,
      ]
        .filter(Boolean)
        .forEach((id) => nextEntrantIds.add(String(id)));
    });
    matchEntrants.forEach((row) => {
      if (row.entrant_id) {
        nextEntrantIds.add(String(row.entrant_id));
      }
    });
    eliminatorEntries.forEach((row) => {
      if (row.entrant_id) {
        nextEntrantIds.add(String(row.entrant_id));
      }
    });
    rumbleEntries.forEach((row) => {
      if (row.entrant_id) {
        nextEntrantIds.add(String(row.entrant_id));
      }
    });
    const currentIds = new Set(entrants.map((entrant) => entrant.id));
    const missingIds = Array.from(nextEntrantIds).filter(
      (id) => !currentIds.has(id)
    );
    if (missingIds.length > 0) {
      const { data: entrantRows, error: entrantError } = await supabase
        .from("entrants")
        .select("id, name, promotion, image_url")
        .in("id", missingIds);
      if (entrantError) {
        setMessage(entrantError.message);
        return;
      }
      setEntrants((prev) => {
        const next = new Map(prev.map((entrant) => [entrant.id, entrant]));
        (entrantRows ?? []).forEach((entrant) => {
          next.set(entrant.id, entrant);
        });
        return Array.from(next.values());
      });
    }
  }, [
    eliminatorEntries,
    eliminators,
    entrants,
    events,
    matchEntrants,
    rumbleEntries,
    userId,
    validShowId,
  ]);

  useEffect(() => {
    load();

    if (!validShowId) {
      return;
    }

    if (typeof document !== "undefined" && document.hidden) {
      return;
    }

    const interval = setInterval(() => {
      loadLive();
    }, PICKS_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [load, loadLive, validShowId]);

  useEffect(() => {
    if (!validShowId) return;
    const handleVisibility = () => {
      if (document.hidden) return;
      loadLive();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [loadLive, validShowId]);

  const renderList = (
    ids: string[] | undefined,
    correctSet: Set<string>,
    points: number,
    actualsHasData: boolean,
    totalEntries?: number,
    confirmedSet?: Set<string>
  ) => {
    if (!ids || ids.length === 0) {
      return <p className="text-sm text-zinc-400">None selected.</p>;
    }
    return (
      <ul className="mt-4 space-y-2 text-sm text-zinc-200">
        {ids.map((id) => {
          const entrant = entrantMap.get(id);
          const isConfirmed = Boolean(confirmedSet?.has(id));
          const isCorrect = actualsHasData && correctSet.has(id);
          const showMisses =
            actualsHasData && (totalEntries === undefined || totalEntries >= 30);
          const showConfirmed =
            actualsHasData && totalEntries !== undefined && totalEntries >= 30 && isConfirmed;
          return (
            <li
              key={id}
              className={`rounded-xl border px-3 py-2 ${
                !actualsHasData || isConfirmed
                  ? "border-zinc-800"
                  : isCorrect
                    ? "border-emerald-400/60 bg-emerald-400/10"
                    : showMisses
                      ? "border-red-500/50 bg-red-500/10"
                      : "border-zinc-800"
              }`}
            >
              <EntrantCard
                name={entrant?.name ?? "Unknown"}
                promotion={entrant?.promotion}
                imageUrl={entrant?.image_url}
              />
              {showConfirmed && (
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                  Confirmed entrant
                </p>
              )}
              {actualsHasData && (isCorrect || showMisses) && !isConfirmed && (
                <p
                  className={`mt-2 text-[10px] font-semibold uppercase tracking-wide ${
                    isCorrect ? "text-emerald-200" : "text-red-200"
                  }`}
                >
                  {isCorrect ? `+${points} pts` : "0 pts"}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  const renderEliminatorOrder = (
    entries: EliminatorEntryRow[],
    orderMap: Record<string, number | null> | undefined
  ) => {
    const ordered = entries
      .map((entry) => {
        const order = orderMap?.[entry.entrant_id];
        if (!order) return null;
        return {
          order,
          name: entrantMap.get(entry.entrant_id)?.name ?? "Entrant",
        };
      })
      .filter(
        (entry): entry is { order: number; name: string } =>
          entry !== null,
      )
      .sort((a, b) => a.order - b.order);
    if (ordered.length === 0) return "Not set";
    return ordered.map((entry) => `${entry.order}. ${entry.name}`).join(", ");
  };

  const renderEliminatorTypes = (
    entries: EliminatorEntryRow[],
    typeMap: Record<string, "pinfall" | "submission" | null> | undefined,
    orderMap: Record<string, number | null> | undefined
  ) => {
    const ordered = entries
      .map((entry) => {
        const type = typeMap?.[entry.entrant_id];
        if (!type) return null;
        return {
          order: orderMap?.[entry.entrant_id] ?? 999,
          name: entrantMap.get(entry.entrant_id)?.name ?? "Entrant",
          type: type === "pinfall" ? "Pinfall" : "Submission",
        };
      })
      .filter(
        (entry): entry is { order: number; name: string; type: string } =>
          entry !== null,
      )
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    if (ordered.length === 0) return "Not set";
    return ordered.map((entry) => `${entry.name}: ${entry.type}`).join(", ");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
          <p>Loading picks…</p>
        </main>
      </div>
    );
  }

  if (message) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 text-center">
          <p>{message}</p>
        </main>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 text-center">
          <p>No picks found for this user.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-6">
        <div className="mb-6">
          <Link
            className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200 hover:text-amber-100"
            href={validShowId ? `/scoreboard?show=${validShowId}` : "/scoreboard"}
          >
            ← Back to scoreboard
          </Link>
        </div>
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Picks
          </p>
          <h1 className="text-3xl font-semibold">
            {profile?.display_name ?? "Rumble Fan"}
          </h1>
          <p className="text-sm text-zinc-400">
            {show?.name ?? "Show"}
          </p>
          <p className="text-sm text-zinc-300">
            {rankInfo.rank
              ? `Rank #${rankInfo.rank} of ${rankInfo.total} · ${totalShowPoints} pts`
              : `Total points: ${totalShowPoints}`}
          </p>
        </header>

        

        {events.length > 0 &&
          events.map((event) => {
            const rumblePick = payload.rumbles?.[event.id] ?? emptyRumblePick;
            const actuals = actualsByEvent[event.id] ?? emptyActuals;
            const eventPoints = eventPointsByEvent[event.id] ?? {
              entrants: 0,
              finalFour: 0,
              keyPicks: 0,
              total: 0,
            };
            return (
              <section key={event.id} className="mt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold">{event.name}</h2>
                  <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                    {eventPoints.total} pts
                  </span>
                </div>
                <div className="mt-4 grid gap-4">
                  <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <details className="group peer">
                      <summary className="relative flex cursor-pointer list-none items-center justify-between gap-3 overflow-hidden">
                        <div className="relative z-10">
                          <h3 className="text-lg font-semibold">Entrants</h3>
                          <p className="mt-2 text-sm text-zinc-400">
                            {rumblePick.entrants.length} selected
                          </p>
                          <p className="mt-1 text-xs text-emerald-200">
                            Points: {eventPoints.entrants}
                          </p>
                        </div>
                        <span className="pointer-events-none absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-zinc-800 bg-black p-2 text-amber-200 shadow-sm transition group-open:rotate-180">
                          <ChevronIcon />
                        </span>
                      </summary>
                      <div className="mt-3">
                        {renderList(
                          rumblePick.entrants,
                          actuals.entrantSet,
                          scoringRules.entrants,
                          actuals.hasData,
                          actuals.totalEntries,
                          actuals.confirmedSet
                        )}
                      </div>
                    </details>
                    <div className="peer-open:hidden">
                      {renderGhostStrip(rumblePick.entrants, 3)}
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <details className="group peer">
                      <summary className="relative flex cursor-pointer list-none items-center justify-between gap-3 overflow-hidden">
                        <div className="relative z-10">
                          <h3 className="text-lg font-semibold">Final Four</h3>
                          <p className="mt-2 text-sm text-zinc-400">
                            {rumblePick.final_four.length} selected
                          </p>
                          <p className="mt-1 text-xs text-emerald-200">
                            Points: {eventPoints.finalFour}
                          </p>
                        </div>
                        <span className="pointer-events-none absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-zinc-800 bg-black p-2 text-amber-200 shadow-sm transition group-open:rotate-180">
                          <ChevronIcon />
                        </span>
                      </summary>
                      <div className="mt-3">
                        {renderList(
                          rumblePick.final_four,
                          actuals.finalFourSet,
                          scoringRules.final_four,
                          actuals.finalFourReady
                        )}
                      </div>
                    </details>
                    <div className="peer-open:hidden">
                      {renderGhostStrip(rumblePick.final_four, 3)}
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <details className="group peer">
                      <summary className="relative flex cursor-pointer list-none items-center justify-between gap-3 overflow-hidden">
                        <div className="relative z-10">
                          <h3 className="text-lg font-semibold">Key Picks</h3>
                          <p className="mt-2 text-sm text-zinc-400">
                            Winner:{" "}
                            {rumblePick.winner
                              ? entrantMap.get(String(rumblePick.winner))?.name ?? "Selected"
                              : "Not set"}
                          </p>
                          <p className="mt-1 text-xs text-emerald-200">
                            Points: {eventPoints.keyPicks}
                          </p>
                        </div>
                        <span className="pointer-events-none absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-zinc-800 bg-black p-2 text-amber-200 shadow-sm transition group-open:rotate-180">
                          <ChevronIcon />
                        </span>
                      </summary>
                      <div className="mt-3 space-y-3 text-sm text-zinc-200">
                        {(() => {
                          const ironLabel =
                            event.rumble_gender === "women" ? "Iron woman" : "Iron man";
                          return [
                          [
                            "Winner",
                            rumblePick.winner,
                            actuals.winner,
                            scoringRules.winner,
                            actuals.winnerReady,
                          ],
                          [
                            "Entry #1",
                            rumblePick.entry_1,
                            actuals.entry1,
                            scoringRules.entry_1,
                            actuals.entry1Ready,
                          ],
                          [
                            "Entry #2",
                            rumblePick.entry_2,
                            actuals.entry2,
                            scoringRules.entry_2,
                            actuals.entry2Ready,
                          ],
                          [
                            "Entry #30",
                            rumblePick.entry_30,
                            actuals.entry30,
                            scoringRules.entry_30,
                            actuals.entry30Ready,
                          ],
                          [
                            ironLabel,
                            rumblePick.iron_person,
                            actuals.ironPerson,
                            scoringRules.iron_person,
                            actuals.ironPersonReady,
                          ],
                          [
                            "Most eliminations",
                            rumblePick.most_eliminations,
                            null,
                            scoringRules.most_eliminations,
                            actuals.mostElimsReady,
                          ],
                        ];
                        })().map(([label, value, actual, points, isReady]) => {
                          const entrant = value ? entrantMap.get(String(value)) : null;
                          const ready = Boolean(isReady);
                          const isCorrect =
                            ready &&
                            (label === "Most eliminations"
                              ? value && actuals.topElims.has(String(value))
                              : value && actual === value);
                          return (
                            <div
                              key={label}
                              className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                                !ready
                                  ? "border-zinc-800"
                                  : isCorrect
                                    ? "border-emerald-400/60 bg-emerald-400/10"
                                    : "border-red-500/50 bg-red-500/10"
                              }`}
                            >
                              <span className="text-zinc-400">{label}</span>
                              <EntrantCard
                                name={entrant?.name ?? "Not set"}
                                promotion={entrant?.promotion}
                                imageUrl={entrant?.image_url}
                                className="justify-end"
                              />
                              {ready && (
                                <span
                                  className={`ml-3 text-[10px] font-semibold uppercase tracking-wide ${
                                    isCorrect ? "text-emerald-200" : "text-red-200"
                                  }`}
                                >
                                  {isCorrect ? `+${points} pts` : "0 pts"}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                    <div className="peer-open:hidden">
                      {renderGhostStrip(
                        [
                          rumblePick.winner,
                          rumblePick.entry_1,
                          rumblePick.entry_2,
                          rumblePick.entry_30,
                          rumblePick.iron_person,
                          rumblePick.most_eliminations,
                        ].filter(Boolean) as string[],
                        3
                      )}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}

        {eliminators.length > 0 && (
          <section className="mt-10">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">Eliminator Picks</h2>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                {eliminatorPointsSummary} pts
              </span>
            </div>
            <div className="mt-4 grid gap-4">
              {eliminators.map((eliminator) => {
                const pick =
                  payload.eliminators?.[eliminator.id] ?? emptyEliminatorPick;
                const entries = eliminatorEntries.filter(
                  (entry) => entry.eliminator_id === eliminator.id
                );
                const points = eliminatorPointsById[eliminator.id] ?? {
                  entryOrder: 0,
                  eliminationOrder: 0,
                  eliminationType: 0,
                  mostElims: 0,
                  total: 0,
                };
                const entryOrderText = renderEliminatorOrder(
                  entries,
                  pick.entry_order
                );
                const eliminationOrderText = renderEliminatorOrder(
                  entries,
                  pick.elimination_order
                );
                const eliminationTypeText = renderEliminatorTypes(
                  entries,
                  pick.elimination_type,
                  pick.elimination_order
                );
                const winnerName = pick.winner_id
                  ? entrantMap.get(pick.winner_id)?.name ?? "Selected"
                  : "Not set";
                const mostElimsName = pick.most_eliminations
                  ? entrantMap.get(pick.most_eliminations)?.name ?? "Selected"
                  : "Not set";

                return (
                  <div
                    key={eliminator.id}
                    className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
                  >
                    <details className="group peer">
                      <summary className="relative flex cursor-pointer list-none items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                            Eliminator
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold text-zinc-100">
                              {eliminator.name}
                            </p>
                            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                              {points.total} pts
                            </span>
                          </div>
                        </div>
                        <span className="pointer-events-none absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-zinc-800 bg-black p-2 text-amber-200 shadow-sm transition group-open:rotate-180">
                          <ChevronIcon />
                        </span>
                      </summary>
                      {entries.length === 0 ? (
                        <p className="mt-3 text-sm text-zinc-400">
                          No entrants available yet.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-3 text-sm text-zinc-200">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                                Entry order
                              </span>
                              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                                {points.entryOrder} pts
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-zinc-300">
                              {entryOrderText}
                            </p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                                Elimination order
                              </span>
                              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                                {points.eliminationOrder} pts
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-zinc-300">
                              {eliminationOrderText}
                            </p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                                Elimination type
                              </span>
                              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                                {points.eliminationType} pts
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-zinc-300">
                              {eliminationTypeText}
                            </p>
                          </div>
                          <div className="flex items-center justify-between text-sm text-zinc-200">
                            <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                              Winner
                            </span>
                            <span className="text-sm text-zinc-300">
                              {winnerName}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-zinc-200">
                            <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                              Most eliminations
                            </span>
                            <span className="text-sm text-zinc-300">
                              {mostElimsName}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                              {points.mostElims} pts
                            </span>
                          </div>
                        </div>
                      )}
                    </details>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Match Picks</h2>
          <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
            {matchPointsSummary.total} pts
          </span>
        </div>
        <section className="mt-4">
          {matches.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No matches available.</p>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-zinc-200">
              {matches.map((match) => {
                const pick = payload.match_picks?.[match.id] ?? null;
                const winner = matchWinnerMap.get(match.id) ?? null;
                const sides = matchSidesByMatch[match.id] ?? [];
                const pickEntrants = pick
                  ? (matchEntrantsByMatch[match.id] ?? [])
                      .filter((row) => row.side_id === pick)
                      .map((row) => entrantMap.get(row.entrant_id))
                      .filter(Boolean)
                  : [];
                const matchStats = matchPickStats[match.id];
                const matchTotal = matchStats?.total ?? 0;
                const percentForSide = (sideId?: string | null) => {
                  if (!sideId || matchTotal === 0) return null;
                  const count = matchStats?.bySide?.[sideId] ?? 0;
                  return Math.round((count / matchTotal) * 100);
                };
                const sideEntries = sides.map((side, index) => {
                  const entrantsForSide = (matchEntrantsByMatch[match.id] ?? [])
                    .filter((row) => row.side_id === side.id)
                    .map((row) => entrantMap.get(row.entrant_id))
                    .filter(Boolean);
                  const label =
                    side.label?.trim() && entrantsForSide.length > 1
                      ? side.label.trim()
                      : entrantsForSide
                          .map((entrant) => entrant?.name)
                          .filter(Boolean)
                          .join(" • ") || `Side ${index + 1}`;
                  return {
                    id: side.id,
                    label,
                    percent: percentForSide(side.id),
                  };
                });
                const pickSide = sides.find((side) => side.id === pick) ?? null;
                const pickSideLabel =
                  pickSide?.label?.trim() && pickEntrants.length > 1
                    ? pickSide.label.trim()
                    : null;
                const pickEntrantIds = pickEntrants
                  .map((entrant) => entrant?.id)
                  .filter(Boolean) as string[];
                const entrantCount = (matchEntrantsByMatch[match.id] ?? []).length;
                const finishPick = payload.match_finish_picks?.[match.id];
                const lengthPick = payload.match_length_picks?.[match.id] ?? null;
                const interferencePick =
                  payload.match_interference_picks?.[match.id] ?? null;
                const finishMethod = finishPick?.method ?? null;
                const finishWinner = finishPick?.winner
                  ? entrantMap.get(finishPick.winner)
                  : null;
                const finishLoser = finishPick?.loser
                  ? entrantMap.get(finishPick.loser)
                  : null;
                const finishMethodCorrect =
                  match.finish_method && finishMethod
                    ? match.finish_method === finishMethod
                    : false;
                const finishWinnerCorrect =
                  match.finish_winner_entrant_id && finishPick?.winner
                    ? match.finish_winner_entrant_id === finishPick.winner
                    : false;
                const finishLoserCorrect =
                  match.finish_loser_entrant_id && finishPick?.loser
                    ? match.finish_loser_entrant_id === finishPick.loser
                    : false;
                const matchLengthCorrect =
                  match.match_length && lengthPick
                    ? match.match_length === lengthPick
                    : false;
                const matchInterferenceCorrect =
                  match.match_interference && interferencePick
                    ? match.match_interference === interferencePick
                    : false;
                const isCorrect = winner && pick ? winner === pick : false;
                const matchTotalPoints =
                  (isCorrect ? scoringRules.match_winner : 0) +
                  (finishMethodCorrect ? scoringRules.match_finish_method : 0) +
                  (finishWinnerCorrect ? scoringRules.match_finish_winner : 0) +
                  (finishLoserCorrect ? scoringRules.match_finish_loser : 0) +
                  (matchLengthCorrect ? scoringRules.match_length : 0) +
                  (matchInterferenceCorrect ? scoringRules.match_interference : 0);
                const showFinishDetails =
                  !!finishMethod ||
                  !!match.finish_method ||
                  !!finishPick ||
                  !!lengthPick ||
                  !!interferencePick;

                return (
                  <div
                    key={match.id}
                    className={`relative overflow-hidden rounded-2xl border px-3 py-2 ${
                      !winner
                        ? "border-zinc-800 bg-zinc-900/70"
                        : isCorrect
                          ? "border-emerald-400/60 bg-emerald-400/10"
                          : "border-red-500/50 bg-red-500/10"
                    }`}
                  >
                    <details className="group peer">
                      <summary className="relative flex cursor-pointer list-none items-start justify-between gap-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                                {match.kind}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-zinc-100">
                                  {match.name}
                                </p>
                                <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                                  {matchTotalPoints} pts
                                </span>
                              </div>
                            </div>
                            {winner && (
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wide ${
                                  isCorrect ? "text-emerald-200" : "text-red-200"
                                }`}
                              >
                                {isCorrect ? `+${scoringRules.match_winner} pts` : "0 pts"}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-zinc-200">
                            Winner pick:{" "}
                            <span className="font-semibold text-zinc-400">
                              {pickSideLabel ??
                                (pickEntrants.length > 0
                                  ? pickEntrants
                                      .map((entrant) => entrant?.name)
                                      .filter(Boolean)
                                      .join(", ")
                                  : "Not set")}
                            </span>
                          </div>
                        </div>
                        <span className="pointer-events-none absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-zinc-800 bg-black p-2 text-amber-200 shadow-sm transition group-open:rotate-180">
                          <ChevronIcon />
                        </span>
                      </summary>
                      {showFinishDetails && (
                        <div className="mt-3 space-y-2 text-xs text-zinc-400">
                          <div className="flex items-center justify-between">
                            <span>Match length</span>
                            <span
                              className={
                                !match.match_length
                                  ? "text-zinc-500"
                                  : matchLengthCorrect
                                    ? "text-emerald-200"
                                    : "text-red-200"
                              }
                            >
                              {lengthPick ? lengthPick.replace("_", " ") : "Not set"}
                              {match.match_length
                                ? ` • ${
                                    matchLengthCorrect
                                      ? `+${scoringRules.match_length}`
                                      : "0"
                                  } pts`
                                : ""}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Interference</span>
                            <span
                              className={
                                !match.match_interference
                                  ? "text-zinc-500"
                                  : matchInterferenceCorrect
                                    ? "text-emerald-200"
                                    : "text-red-200"
                              }
                            >
                              {interferencePick
                                ? interferencePick === "yes"
                                  ? "Yes"
                                  : "No"
                                : "Not set"}
                              {match.match_interference
                                ? ` • ${
                                    matchInterferenceCorrect
                                      ? `+${scoringRules.match_interference}`
                                      : "0"
                                  } pts`
                                : ""}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Finish</span>
                            <span
                              className={
                                !match.finish_method
                                  ? "text-zinc-500"
                                  : finishMethodCorrect
                                    ? "text-emerald-200"
                                    : "text-red-200"
                              }
                            >
                              {finishMethod ?? "Not set"}
                              {match.finish_method
                                ? ` • ${
                                    finishMethodCorrect
                                      ? `+${scoringRules.match_finish_method}`
                                      : "0"
                                  } pts`
                                : ""}
                            </span>
                          </div>
                          {(finishMethod === "pinfall" ||
                            finishMethod === "submission") &&
                            entrantCount > 2 && (
                            <>
                              <div className="flex items-center justify-between">
                                <span>Winner</span>
                                <span
                                  className={
                                    match.finish_winner_entrant_id
                                      ? finishWinnerCorrect
                                        ? "text-emerald-200"
                                        : "text-red-200"
                                      : "text-zinc-500"
                                  }
                                >
                                  {finishWinner?.name ?? "Not set"}
                                  {match.finish_winner_entrant_id
                                    ? ` • ${
                                        finishWinnerCorrect
                                          ? `+${scoringRules.match_finish_winner}`
                                          : "0"
                                      } pts`
                                    : ""}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Loser</span>
                                <span
                                  className={
                                    match.finish_loser_entrant_id
                                      ? finishLoserCorrect
                                        ? "text-emerald-200"
                                        : "text-red-200"
                                      : "text-zinc-500"
                                  }
                                >
                                  {finishLoser?.name ?? "Not set"}
                                  {match.finish_loser_entrant_id
                                    ? ` • ${
                                        finishLoserCorrect
                                          ? `+${scoringRules.match_finish_loser}`
                                          : "0"
                                      } pts`
                                    : ""}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </details>
                    <div className="peer-open:hidden">
                      {renderGhostStrip(pickEntrantIds, 3)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
