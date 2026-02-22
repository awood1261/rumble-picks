"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { scoringRules } from "../../lib/scoringRules";
import {
  CustomEntrantModal,
  KeyPicksEditor,
  LockStatusBanner,
  MatchPicksSection,
  MatchSummarySection,
  MessageBanner,
  PicksHeader,
  RumbleEntrantsEditor,
  RumbleFinalFourEditor,
  RumbleSummarySection,
  SavePicksFooter,
  ShowSelector,
} from "../../components/PicksSections";
import type {
  EditSection,
  EntrantRow,
  EventActuals,
  EventRow,
  MatchEntrantRow,
  MatchRow,
  MatchSideRow,
  PicksPayload,
  PromotionRow,
  RankInfo,
  RumbleEntryRow,
  RumblePick,
  SectionPoints,
  ShowRow,
} from "../../lib/picksTypes";

const SCORING_POLL_INTERVAL_MS = 15000;

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

const emptyPayload: PicksPayload = {
  rumbles: {},
  match_picks: {},
  match_finish_picks: {},
  match_length_picks: {},
  match_interference_picks: {},
};

const emptyActuals: EventActuals = {
  entrantSet: new Set(),
  confirmedSet: new Set(),
  finalFourSet: new Set(),
  winner: null,
  entry1: null,
  entry2: null,
  entry30: null,
  ironPerson: null,
  topElims: new Set(),
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

export default function PicksPage() {
  const searchParams = useSearchParams();
  const queryShowId = searchParams.get("show");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [shows, setShows] = useState<ShowRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedShowId, setSelectedShowId] = useState<string>("");
  const [entrants, setEntrants] = useState<EntrantRow[]>([]);
  const [rumbleEntries, setRumbleEntries] = useState<RumbleEntryRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchSides, setMatchSides] = useState<MatchSideRow[]>([]);
  const [matchEntrants, setMatchEntrants] = useState<MatchEntrantRow[]>([]);
  const [payload, setPayload] = useState<PicksPayload>(emptyPayload);
  const [saving, setSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [rankInfo, setRankInfo] = useState<RankInfo>({ rank: null, total: 0 });
  const [customEntrantName, setCustomEntrantName] = useState("");
  const [entrantSearch, setEntrantSearch] = useState("");
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customModalEventId, setCustomModalEventId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const keyPicksRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [editSection, setEditSection] = useState<EditSection>(null);
  const [focusedEventId, setFocusedEventId] = useState<string>("");

  const selectedShow = useMemo(
    () => shows.find((show) => show.id === selectedShowId) ?? null,
    [shows, selectedShowId]
  );
  const showEvents = useMemo(
    () => events.filter((event) => event.show_id === selectedShowId),
    [events, selectedShowId]
  );
  const selectedPromotionImageUrl = useMemo(() => {
    if (!selectedShow?.promotion_id) return null;
    return (
      promotions.find((promotion) => promotion.id === selectedShow.promotion_id)
        ?.image_url ?? null
    );
  }, [promotions, selectedShow?.promotion_id]);
  const visibleShowEvents = useMemo(() => {
    if (!focusedEventId) return showEvents;
    return showEvents.filter((event) => event.id === focusedEventId);
  }, [focusedEventId, showEvents]);
  const customModalEvent = useMemo(
    () => showEvents.find((event) => event.id === customModalEventId) ?? null,
    [customModalEventId, showEvents]
  );
  const isLocked = useMemo(() => {
    if (!selectedShow?.starts_at) return false;
    return new Date() >= new Date(selectedShow.starts_at);
  }, [selectedShow?.starts_at]);

  const lockInfo = useMemo(() => {
    if (!selectedShow?.starts_at) {
      return {
        label: "Lock time not set",
        detail: "",
      };
    }
    const startTime = new Date(selectedShow.starts_at).getTime();
    const diffMs = startTime - now;
    const absMs = Math.abs(diffMs);
    const minutes = Math.floor(absMs / 60000) % 60;
    const hours = Math.floor(absMs / 3600000) % 24;
    const days = Math.floor(absMs / 86400000);
    const parts = [
      days ? `${days}d` : null,
      hours ? `${hours}h` : null,
      `${minutes}m`,
    ].filter(Boolean);
    const timeString = parts.join(" ");
    if (diffMs > 0) {
      return {
        label: `Locks in ${timeString}`,
        detail: "",
      };
    }
    return {
      label: `Locked ${timeString} ago`,
      detail: "",
    };
  }, [selectedShow?.starts_at, now]);

  const entrantOptionsByEvent = useMemo(() => {
    const byEvent: Record<string, EntrantRow[]> = {};
    showEvents.forEach((event) => {
      const gender = event.rumble_gender;
      const byName = new Map<string, EntrantRow>();
      entrants
        .filter((entrant) => {
          const matchesGender = !gender || entrant.gender === gender;
          const matchesYear =
            !event.roster_year || entrant.roster_year === event.roster_year;
          const matchesEvent = entrant.event_id === event.id;
          const isRosterEntrant = entrant.event_id === null;
          const status = entrant.status ?? "approved";
          const isApproved = status === "approved";
          const isUserPending =
            status === "pending" && entrant.created_by === userId;
          return (
            matchesGender &&
            (matchesEvent || (isRosterEntrant && matchesYear)) &&
            (isApproved || isUserPending)
          );
        })
        .forEach((entrant) => {
          const nameKey = entrant.name.trim().toLowerCase();
          const current = byName.get(nameKey);
          if (!current) {
            byName.set(nameKey, entrant);
            return;
          }
          const currentIsWwe = (current.promotion ?? "").toLowerCase() === "wwe";
          const nextIsWwe = (entrant.promotion ?? "").toLowerCase() === "wwe";
          if (!currentIsWwe && nextIsWwe) {
            byName.set(nameKey, entrant);
          }
        });
      byEvent[event.id] = Array.from(byName.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    });
    return byEvent;
  }, [entrants, showEvents, userId]);

  const entrantByIdAll = useMemo(() => {
    return new Map(entrants.map((entrant) => [entrant.id, entrant]));
  }, [entrants]);

  const getEventEntrants = useCallback(
    (eventId: string) => entrantOptionsByEvent[eventId] ?? [],
    [entrantOptionsByEvent]
  );

  const getRumblePick = useCallback(
    (eventId: string) => payload.rumbles[eventId] ?? emptyRumblePick,
    [payload.rumbles]
  );

  const getSelectedEntrantOptions = useCallback(
    (eventId: string) => {
      const current = getRumblePick(eventId);
      const selected = new Set(current.entrants);
      return getEventEntrants(eventId).filter((entrant) => selected.has(entrant.id));
    },
    [getEventEntrants, getRumblePick]
  );

  const getSelectedFinalFourOptions = useCallback(
    (eventId: string) => {
      const current = getRumblePick(eventId);
      const selected = new Set(current.final_four);
      return getEventEntrants(eventId).filter((entrant) => selected.has(entrant.id));
    },
    [getEventEntrants, getRumblePick]
  );

  const getFilteredEntrantsByPromotion = useCallback(
    (eventId: string) => {
      const entrantsForEvent = getEventEntrants(eventId);
      const grouped = entrantsForEvent.reduce((groups, entrant) => {
        const key = entrant.promotion ?? "Other";
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(entrant);
        return groups;
      }, {} as Record<string, EntrantRow[]>);

      const query = entrantSearch.trim().toLowerCase();
      if (!query) {
        const count = entrantsForEvent.length;
        return { grouped, count };
      }

      const filtered: Record<string, EntrantRow[]> = {};
      Object.entries(grouped).forEach(([promotion, list]) => {
        const matches = list.filter((entrant) =>
          entrant.name.toLowerCase().includes(query)
        );
        if (matches.length > 0) {
          filtered[promotion] = matches;
        }
      });
      const count = Object.values(filtered).reduce(
        (total, list) => total + list.length,
        0
      );
      return { grouped: filtered, count };
    },
    [entrantSearch, getEventEntrants]
  );

  const hasEntrantsForShow = useMemo(
    () => showEvents.some((event) => getEventEntrants(event.id).length > 0),
    [showEvents, getEventEntrants]
  );
  const hasEvents = showEvents.length > 0;
  const canShowRumbles = hasEvents && hasEntrantsForShow;

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

  const getEliminationKey = (entry: RumbleEntryRow) =>
    entry.eliminated_at
      ? new Date(entry.eliminated_at).getTime()
      : Number.MAX_SAFE_INTEGER;

  const actualsByEvent = useMemo(() => {
    const byEvent: Record<string, EventActuals> = {};
    showEvents.forEach((event) => {
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
      const mostElimsReady = totalEntries >= 30 && remainingCount === 1;
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
  }, [rumbleEntries, showEvents]);

  const matchPoints = useMemo(() => {
    if (matches.length === 0) return null;
    return matches.reduce((total, match) => {
      const pick = payload.match_picks[match.id];
      if (match.winner_side_id && pick && pick === match.winner_side_id) {
        total += scoringRules.match_winner;
      }
      const entrantCount = (matchEntrantsByMatch[match.id] ?? []).length;
      if (match.finish_method) {
        const finishPick = payload.match_finish_picks[match.id];
        if (finishPick?.method === match.finish_method) {
          total += scoringRules.match_finish_method;
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
              total += scoringRules.match_finish_winner;
            }
            if (
              match.finish_loser_entrant_id &&
              finishPick.loser === match.finish_loser_entrant_id
            ) {
              total += scoringRules.match_finish_loser;
            }
          }
        }
      }
      return total;
    }, 0);
  }, [matches, payload.match_finish_picks, payload.match_picks, matchEntrantsByMatch]);

  const sectionPointsByEvent = useMemo(() => {
    const byEvent: Record<string, SectionPoints> = {};
    showEvents.forEach((event) => {
      const actuals = actualsByEvent[event.id];
      const pick = payload.rumbles[event.id] ?? emptyRumblePick;
      if (!actuals || !actuals.hasData) {
        byEvent[event.id] = { entrants: null, finalFour: null, keyPicks: null };
        return;
      }
      const entrantsCorrect = pick.entrants.filter((id) =>
        actuals.entrantSet.has(id)
      ).length;
      const finalFourCorrect = actuals.finalFourReady
        ? pick.final_four.filter((id) => actuals.finalFourSet.has(id)).length
        : 0;
      const keyPicksTotal =
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

      byEvent[event.id] = {
        entrants: entrantsCorrect * scoringRules.entrants,
        finalFour: actuals.finalFourReady
          ? finalFourCorrect * scoringRules.final_four
          : 0,
        keyPicks: actuals.winnerReady ||
          actuals.entry1Ready ||
          actuals.entry2Ready ||
          actuals.entry30Ready ||
          actuals.ironPersonReady ||
          actuals.mostElimsReady
          ? keyPicksTotal
          : 0,
      };
    });
    return byEvent;
  }, [actualsByEvent, payload.rumbles, showEvents]);

  useEffect(() => {
    let ignore = false;
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (ignore) return;
      const session = data.session;
      setSessionEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
      setLoading(false);
    };

    loadSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
      setUserId(session?.user.id ?? null);
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionEmail) return;
    Promise.all([
      supabase
        .from("shows")
        .select("id, name, image_url, promotion_id, status, starts_at")
        .order("name", { ascending: true }),
      supabase
        .from("promotions")
        .select("id, name, image_url")
        .order("name", { ascending: true }),
      supabase
        .from("events")
        .select("id, name, status, rumble_gender, roster_year, show_id, iron_person_entrant_id")
        .order("name", { ascending: true }),
    ]).then(([showsResult, promotionsResult, eventsResult]) => {
      if (showsResult.error) {
        setMessage(showsResult.error.message);
        return;
      }
      if (promotionsResult.error) {
        setMessage(promotionsResult.error.message);
        return;
      }
      if (eventsResult.error) {
        setMessage(eventsResult.error.message);
        return;
      }
      const showRows = showsResult.data ?? [];
      setShows(showRows);
      setPromotions(promotionsResult.data ?? []);
      setEvents(eventsResult.data ?? []);
      if (showRows.length > 0) {
        setSelectedShowId((prev) => prev || queryShowId || showRows[0].id);
      }
    });
  }, [sessionEmail, queryShowId]);

  useEffect(() => {
    if (!selectedShow?.starts_at) return;
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [selectedShow?.starts_at]);

  const loadRumbleEntries = useCallback(async () => {
    if (!selectedShowId) return;
    const eventIds = showEvents.map((event) => event.id);
    if (eventIds.length === 0) {
      setRumbleEntries([]);
      return;
    }
    const { data: entryRows, error } = await supabase
      .from("rumble_entries")
      .select(
        "event_id, entrant_id, entry_number, eliminated_at, eliminations_count, is_confirmed"
      )
      .in("event_id", eventIds);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRumbleEntries((entryRows ?? []) as RumbleEntryRow[]);
  }, [selectedShowId, showEvents]);

  const confirmedEntrantsByEvent = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    rumbleEntries.forEach((entry) => {
      if (!entry.is_confirmed) return;
      if (!map[entry.event_id]) {
        map[entry.event_id] = new Set();
      }
      map[entry.event_id].add(entry.entrant_id);
    });
    return map;
  }, [rumbleEntries]);

  const loadMatches = useCallback(async () => {
    if (!selectedShowId) return;
    const { data: matchRows, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, name, kind, match_type, status, winner_entrant_id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id, match_length, match_interference"
      )
      .eq("show_id", selectedShowId)
      .order("created_at", { ascending: true });
    if (matchError) {
      setMessage(matchError.message);
      return;
    }
    const matchList = (matchRows ?? []) as MatchRow[];
    setMatches(matchList);

    if (matchList.length > 0) {
      const matchIds = matchList.map((match) => match.id);
      const [{ data: matchSideRows, error: matchSideError }, { data: matchEntrantRows, error: matchEntrantError }] =
        await Promise.all([
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
        return;
      }
      if (matchEntrantError) {
        setMessage(matchEntrantError.message);
        return;
      }
      setMatchSides((matchSideRows ?? []) as MatchSideRow[]);
      setMatchEntrants((matchEntrantRows ?? []) as MatchEntrantRow[]);
    } else {
      setMatchSides([]);
      setMatchEntrants([]);
    }
  }, [selectedShowId]);

  useEffect(() => {
    if (!selectedShowId || !userId) return;
    setMessage(null);
    setPayload(emptyPayload);
    setHasSaved(false);
    setEditSection(null);
    setFocusedEventId("");

    const loadShowData = async () => {
      const [{ data: pickRows }, { data: entrantRows, error: entrantError }] =
        await Promise.all([
          supabase
            .from("picks")
            .select("payload")
            .eq("show_id", selectedShowId)
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("entrants")
            .select(
              "id, name, promotion, gender, image_url, roster_year, event_id, is_custom, created_by, status"
            )
            .order("name", { ascending: true }),
        ]);

      if (entrantError) {
        setMessage(entrantError.message);
        return;
      }

      setEntrants(entrantRows ?? []);
      await loadRumbleEntries();
      await loadMatches();

      const savedPayload = pickRows?.payload as Partial<PicksPayload> | null;
      const nextRumbles: Record<string, RumblePick> = {};
      const existingRumbles = savedPayload?.rumbles ?? {};
      showEvents.forEach((event) => {
        const base = {
          ...emptyRumblePick,
          ...(existingRumbles[event.id] ?? {}),
        };
        nextRumbles[event.id] = {
          ...base,
        };
      });

      if (savedPayload) {
        setPayload({
          rumbles: nextRumbles,
          match_picks: (savedPayload.match_picks as Record<string, string | null>) ?? {},
          match_finish_picks:
            (savedPayload.match_finish_picks as Record<
              string,
              { method: string | null; winner: string | null; loser: string | null }
            >) ?? {},
          match_length_picks:
            (savedPayload.match_length_picks as Record<
              string,
              "sprint" | "standard" | "epic" | null
            >) ?? {},
          match_interference_picks:
            (savedPayload.match_interference_picks as Record<
              string,
              "yes" | "no" | null
            >) ?? {},
        });
        setHasSaved(true);
      } else {
        setPayload({
          rumbles: nextRumbles,
          match_picks: {},
          match_finish_picks: {},
          match_length_picks: {},
          match_interference_picks: {},
        });
      }
    };

    loadShowData();
  }, [
    selectedShowId,
    userId,
    loadMatches,
    loadRumbleEntries,
    showEvents,
  ]);

  const loadRank = useCallback(async () => {
    if (!selectedShowId || !userId) return;

    const { data, error } = await supabase
      .from("scores")
      .select("user_id, points")
      .eq("show_id", selectedShowId)
      .order("points", { ascending: false });

    if (error || !data) {
      setRankInfo({ rank: null, total: 0 });
      return;
    }

    const total = data.length;
    const index = data.findIndex((row) => row.user_id === userId);
    setRankInfo({ rank: index === -1 ? null : index + 1, total });
  }, [selectedShowId, userId]);

  useEffect(() => {
    loadRank();
  }, [loadRank]);

  useEffect(() => {
    if (!selectedShowId || !userId) return;
    const interval = setInterval(() => {
      loadRank();
      loadRumbleEntries();
      loadMatches();
    }, SCORING_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadRank, loadRumbleEntries, loadMatches, selectedShowId, userId]);

  useEffect(() => {
    setPayload((prev) => {
      const matchIdSet = new Set(matches.map((match) => match.id));
      const matchPicks = Object.fromEntries(
        Object.entries(prev.match_picks ?? {}).filter(([matchId]) =>
          matchIdSet.has(matchId)
        )
      );
      const matchFinishPicks = Object.fromEntries(
        Object.entries(prev.match_finish_picks ?? {}).filter(([matchId]) =>
          matchIdSet.has(matchId)
        )
      );
      const matchLengthPicks = Object.fromEntries(
        Object.entries(prev.match_length_picks ?? {}).filter(([matchId]) =>
          matchIdSet.has(matchId)
        )
      );
      const matchInterferencePicks = Object.fromEntries(
        Object.entries(prev.match_interference_picks ?? {}).filter(([matchId]) =>
          matchIdSet.has(matchId)
        )
      );

      const nextRumbles: Record<string, RumblePick> = {};
      showEvents.forEach((event) => {
        const current = prev.rumbles[event.id] ?? emptyRumblePick;
        const confirmedSet = confirmedEntrantsByEvent[event.id] ?? new Set();
        const selected = new Set([...current.entrants, ...Array.from(confirmedSet)]);
        const finalFour = current.final_four.filter((id) => selected.has(id));
        const finalFourSet = new Set(finalFour);
        nextRumbles[event.id] = {
          ...current,
          entrants: Array.from(selected),
          final_four: finalFour,
          winner:
            current.winner && finalFourSet.has(current.winner)
              ? current.winner
              : null,
          entry_1:
            current.entry_1 && selected.has(current.entry_1)
              ? current.entry_1
              : null,
          entry_2:
            current.entry_2 && selected.has(current.entry_2)
              ? current.entry_2
              : null,
          entry_30:
            current.entry_30 && selected.has(current.entry_30)
              ? current.entry_30
              : null,
          iron_person:
            current.iron_person && selected.has(current.iron_person)
              ? current.iron_person
              : null,
          most_eliminations:
            current.most_eliminations && selected.has(current.most_eliminations)
              ? current.most_eliminations
              : null,
        };
      });

      return {
        ...prev,
        rumbles: nextRumbles,
        match_picks: matchPicks,
        match_finish_picks: matchFinishPicks,
        match_length_picks: matchLengthPicks,
        match_interference_picks: matchInterferencePicks,
      };
    });
  }, [matches, showEvents, confirmedEntrantsByEvent]);

  useEffect(() => {
    if (editSection !== "key_picks") return;
    keyPicksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editSection]);

  const toggleEntrant = (eventId: string, id: string) => {
    setPayload((prev) => {
      const current = prev.rumbles[eventId] ?? emptyRumblePick;
      const confirmedSet = confirmedEntrantsByEvent[eventId] ?? new Set();
      if (confirmedSet.has(id)) {
        return prev;
      }
      const exists = current.entrants.includes(id);
      if (exists) {
        return {
          ...prev,
          rumbles: {
            ...prev.rumbles,
            [eventId]: {
              ...current,
              entrants: current.entrants.filter((item) => item !== id),
            },
          },
        };
      }
      if (current.entrants.length >= 30) {
        setMessage("You can only select up to 30 entrants.");
        return prev;
      }
      return {
        ...prev,
        rumbles: {
          ...prev.rumbles,
          [eventId]: {
            ...current,
            entrants: [...current.entrants, id],
          },
        },
      };
    });
  };

  const toggleFinalFour = (eventId: string, id: string) => {
    setPayload((prev) => {
      const current = prev.rumbles[eventId] ?? emptyRumblePick;
      const exists = current.final_four.includes(id);
      if (exists) {
        return {
          ...prev,
          rumbles: {
            ...prev.rumbles,
            [eventId]: {
              ...current,
              final_four: current.final_four.filter((item) => item !== id),
            },
          },
        };
      }
      if (current.final_four.length >= 4) {
        setMessage("Final four is limited to 4 picks.");
        return prev;
      }
      return {
        ...prev,
        rumbles: {
          ...prev.rumbles,
          [eventId]: {
            ...current,
            final_four: [...current.final_four, id],
          },
        },
      };
    });
  };

  const handleAddCustomEntrant = async () => {
    if (!userId || !customModalEventId || !customModalEvent) return;
    if (isLocked) {
      setMessage("Picks are locked for this show.");
      return;
    }
    const trimmed = customEntrantName.trim();
    if (!trimmed) {
      setMessage("Custom entrant name is required.");
      return;
    }
    const normalized = trimmed.toLowerCase();
    const eventEntrants = getEventEntrants(customModalEventId);
    const existing = eventEntrants.find(
      (entrant) => entrant.name.trim().toLowerCase() === normalized
    );
    if (existing) {
      setMessage("That entrant is already in the list.");
      const currentPick = getRumblePick(customModalEventId);
      if (!currentPick.entrants.includes(existing.id)) {
        toggleEntrant(customModalEventId, existing.id);
      }
      setCustomEntrantName("");
      return;
    }
    const { data, error } = await supabase
      .from("entrants")
      .insert({
        name: trimmed,
        promotion: "Custom",
        gender: customModalEvent.rumble_gender ?? null,
        roster_year: customModalEvent.roster_year ?? null,
        event_id: customModalEventId,
        is_custom: true,
        status: "pending",
        created_by: userId,
        active: true,
      })
      .select("id, name, promotion, gender, image_url, roster_year, event_id, is_custom")
      .single();
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data) {
      setEntrants((prev) => [...prev, data]);
      setPayload((prev) => {
        const current = prev.rumbles[customModalEventId] ?? emptyRumblePick;
        if (current.entrants.length >= 30) return prev;
        return {
          ...prev,
          rumbles: {
            ...prev.rumbles,
            [customModalEventId]: {
              ...current,
              entrants: [...current.entrants, data.id],
            },
          },
        };
      });
      setMessage("Custom entrant added.");
    }
    setCustomEntrantName("");
    setCustomModalOpen(false);
    setCustomModalEventId(null);
  };

  const handleSave = async () => {
    if (!userId || !selectedShowId) return;
    if (isLocked) {
      setMessage("Picks are locked for this show.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from("picks").upsert(
      {
        user_id: userId,
        show_id: selectedShowId,
        payload,
      },
      { onConflict: "user_id,show_id" }
    );
    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }
    setHasSaved(true);
    setEditSection(null);
    setFocusedEventId("");
    setMessage("Picks saved.");
    setSaving(false);
  };

  const handleEditEventSection = (
    section: Exclude<EditSection, "matches" | null>,
    eventId: string
  ) => {
    setFocusedEventId(eventId);
    setEditSection(section);
  };

  const stepItems = useMemo(
    () => [
      ...showEvents.map((event) => ({ type: "event" as const, id: event.id })),
      ...matches.map((match) => ({ type: "match" as const, id: match.id })),
    ],
    [matches, showEvents]
  );
  const stepIndexById = useMemo(() => {
    const map = new Map<string, number>();
    stepItems.forEach((item, index) => {
      map.set(`${item.type}:${item.id}`, index);
    });
    return map;
  }, [stepItems]);
  const totalSteps = stepItems.length;
  const currentStep = stepItems[Math.min(stepIndex, Math.max(totalSteps - 1, 0))];
  const completedSteps = useMemo(() => {
    return stepItems.filter((item) => {
      if (item.type === "match") {
        return Boolean(payload.match_picks[item.id]);
      }
      const pick = getRumblePick(item.id);
      return (
        pick.entrants.length > 0 ||
        pick.final_four.length > 0 ||
        Boolean(pick.winner) ||
        Boolean(pick.entry_1) ||
        Boolean(pick.entry_2) ||
        Boolean(pick.entry_30) ||
        Boolean(pick.iron_person) ||
        Boolean(pick.most_eliminations)
      );
    }).length;
  }, [getRumblePick, payload.match_picks, stepItems]);
  const progressPercent =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  useEffect(() => {
    setStepIndex(0);
  }, [selectedShowId, totalSteps]);

  const handleStepContinue = async () => {
    await handleSave();
    setStepIndex((prev) => Math.min(prev + 1, totalSteps));
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

  if (!sessionEmail) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-semibold">Sign in required</h1>
          <p className="mt-4 text-sm text-zinc-400">
            Visit the login screen to make your picks.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <PicksHeader
          title="Make your predictions"
          subtitle="Lock in your picks here before bell time."
        />
        <LockStatusBanner
          isLocked={isLocked}
          lockInfo={lockInfo}
          rankInfo={rankInfo}
        />
        <MessageBanner message={message} />
        <ShowSelector
          shows={shows}
          selectedShowId={selectedShowId}
          promotionImageUrl={selectedPromotionImageUrl}
        />

        {hasEvents && !hasEntrantsForShow && (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <p className="text-sm text-zinc-400">
              No entrants are available yet.
            </p>
          </section>
        )}
        {totalSteps === 0 ? (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <p className="text-sm text-zinc-400">
              No matches or events are available yet.
            </p>
          </section>
        ) : stepIndex >= totalSteps ? (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-xl font-semibold text-zinc-100">
              All picks are in
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              You can edit your picks until the show starts.
            </p>
            <div className="mt-6 space-y-4">
              {showEvents.map((event) => {
                const pick = getRumblePick(event.id);
                const entrants = pick.entrants
                  .map((id) => entrantByIdAll.get(id)?.name)
                  .filter(Boolean)
                  .join(", ");
                const finalFour = pick.final_four
                  .map((id) => entrantByIdAll.get(id)?.name)
                  .filter(Boolean)
                  .join(", ");
                const winnerEntrant = pick.winner
                  ? entrantByIdAll.get(pick.winner)
                  : null;
                const winner = pick.winner
                  ? entrantByIdAll.get(pick.winner)?.name
                  : null;
                return (
                  <div key={event.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                        {event.name}
                      </p>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition hover:border-amber-400 hover:text-amber-200"
                        onClick={() =>
                          setStepIndex(stepIndexById.get(`event:${event.id}`) ?? 0)
                        }
                        aria-label={`Edit ${event.name}`}
                      >
                        ✎
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-zinc-300">
                      Entrants: {entrants || "None selected"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      Final Four: {finalFour || "None selected"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                      <span>Winner:</span>
                      {winnerEntrant?.image_url ? (
                        <img
                          src={winnerEntrant.image_url}
                          alt={winnerEntrant.name}
                          className="h-7 w-7 rounded-full border border-zinc-700 object-cover"
                        />
                      ) : null}
                      <span>{winner || "Not set"}</span>
                    </div>
                  </div>
                );
              })}
              {matches.map((match) => {
                const winnerSideId = payload.match_picks[match.id] ?? null;
                const sideEntrants = matchEntrantsByMatch[match.id] ?? [];
                const sides = matchSidesByMatch[match.id] ?? [];
                const winnerSide = sides.find((side) => side.id === winnerSideId) ?? null;
                const winnerEntrants = sideEntrants
                  .filter((row) => row.side_id === winnerSideId)
                  .map((row) => entrantByIdAll.get(row.entrant_id))
                  .filter(Boolean) as EntrantRow[];
                const winnerLabel =
                  winnerSide?.label?.trim() && winnerEntrants.length > 1
                    ? winnerSide.label.trim()
                    : null;
                const winnerNames = winnerEntrants
                  .map((entrant) => entrant.name)
                  .filter(Boolean)
                  .join(", ");
                const winnerDisplay = winnerLabel ?? (winnerNames || "Not set");
                return (
                  <div key={match.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                        {match.name}
                      </p>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition hover:border-amber-400 hover:text-amber-200"
                        onClick={() =>
                          setStepIndex(stepIndexById.get(`match:${match.id}`) ?? 0)
                        }
                        aria-label={`Edit ${match.name}`}
                      >
                        ✎
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
                      <span>Winner:</span>
                      {winnerEntrants.length > 0 && (
                        <div className="flex -space-x-2">
                          {winnerEntrants.map((entrant) =>
                            entrant.image_url ? (
                              <img
                                key={entrant.id}
                                src={entrant.image_url}
                                alt={entrant.name}
                                className="h-7 w-7 rounded-full border border-zinc-700 object-cover"
                              />
                            ) : (
                              <div
                                key={entrant.id}
                                className="h-7 w-7 rounded-full border border-zinc-700 bg-zinc-800"
                              />
                            )
                          )}
                        </div>
                      )}
                      <span>{winnerDisplay}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="inline-flex h-11 items-center justify-center rounded-full border border-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                type="button"
                onClick={() => setStepIndex(0)}
              >
                Edit picks
              </button>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
                href={`/scoreboard?show=${selectedShowId}`}
              >
                View scoreboard
              </Link>
            </div>
          </section>
        ) : (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  Step {stepIndex + 1} of {totalSteps}
                </p>
                <h2 className="text-xl font-semibold text-zinc-100">
                  {currentStep?.type === "match" ? "Match picks" : "Event picks"}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {completedSteps} of {totalSteps} picked
                </p>
              </div>
              <div className="w-full max-w-xs">
                <div className="h-2 rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
            {currentStep?.type === "event" && canShowRumbles ? (
              <>
                {showEvents
                  .filter((event) => event.id === currentStep.id)
                  .map((event) => {
                    const eventPick = getRumblePick(event.id);
                    const { grouped, count } = getFilteredEntrantsByPromotion(event.id);
                    const selectedEntrants = getSelectedEntrantOptions(event.id);
                    const selectedFinalFour = getSelectedFinalFourOptions(event.id);
                    return (
                      <div key={event.id} className="mt-6 space-y-6">
                        <RumbleEntrantsEditor
                          event={event}
                          eventPick={eventPick}
                          grouped={grouped}
                          count={count}
                          confirmedEntrantIds={
                            confirmedEntrantsByEvent[event.id] ?? new Set()
                          }
                          entrantSearch={entrantSearch}
                          setEntrantSearch={setEntrantSearch}
                          toggleEntrant={toggleEntrant}
                          hasSaved={false}
                          isLocked={isLocked}
                          onCancel={() => undefined}
                          onSave={handleSave}
                          saving={saving}
                          userId={userId}
                          onOpenCustomModal={() => {
                            setCustomModalEventId(event.id);
                            setCustomModalOpen(true);
                          }}
                        />
                        <RumbleFinalFourEditor
                          event={event}
                          eventPick={eventPick}
                          selectedEntrants={selectedEntrants}
                          toggleFinalFour={toggleFinalFour}
                          hasSaved={false}
                          isLocked={isLocked}
                          onCancel={() => undefined}
                          onSave={handleSave}
                          saving={saving}
                        />
                        <KeyPicksEditor
                          event={event}
                          eventPick={eventPick}
                          selectedEntrants={selectedEntrants}
                          selectedFinalFour={selectedFinalFour}
                          isLocked={isLocked}
                          hasSaved={false}
                          onCancel={() => undefined}
                          onSave={handleSave}
                          saving={saving}
                          onPickChange={(fieldKey, value) =>
                            setPayload((prev) => {
                              const current = prev.rumbles[event.id] ?? emptyRumblePick;
                              return {
                                ...prev,
                                rumbles: {
                                  ...prev.rumbles,
                                  [event.id]: {
                                    ...current,
                                    [fieldKey]: value,
                                  },
                                },
                              };
                            })
                          }
                        />
                      </div>
                    );
                  })}
              </>
            ) : (
              <div className="mt-6">
                {matches
                  .filter((match) => match.id === currentStep?.id)
                  .map((match) => (
                    <MatchPicksSection
                      key={match.id}
                      matches={[match]}
                      matchSidesByMatch={matchSidesByMatch}
                      matchEntrantsByMatch={matchEntrantsByMatch}
                      entrantByIdAll={entrantByIdAll}
                      payload={payload}
                      setPayload={setPayload}
                      isLocked={isLocked}
                      hasSaved={false}
                      onCancel={() => undefined}
                      onSave={handleSave}
                      saving={saving}
                    />
                  ))}
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 px-6 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                disabled={stepIndex === 0}
              >
                Back
              </button>
              <button
                className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-xs font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                type="button"
                onClick={handleStepContinue}
                disabled={saving || isLocked}
              >
                {stepIndex + 1 === totalSteps ? "Finish picks" : "Save & next"}
              </button>
            </div>
          </section>
        )}
        <CustomEntrantModal
          open={customModalOpen}
          event={customModalEvent}
          entrantName={customEntrantName}
          setEntrantName={setCustomEntrantName}
          isLocked={isLocked}
          onClose={() => {
            setCustomModalOpen(false);
            setCustomModalEventId(null);
          }}
          onSubmit={handleAddCustomEntrant}
        />
      </main>
    </div>
  );
}
