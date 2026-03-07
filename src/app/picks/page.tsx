"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { scoringRules } from "../../lib/scoringRules";
import {
  CustomEntrantModal,
  EliminatorPicksSection,
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
  EliminatorEliminationRow,
  EliminatorEntryRow,
  EliminatorRow,
  EliminatorPick,
  PicksPayload,
  PromotionRow,
  RankInfo,
  RumbleEntryRow,
  RumblePick,
  SectionPoints,
  ShowRow,
} from "../../lib/picksTypes";

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
  eliminators: {},
  match_picks: {},
  match_finish_picks: {},
  match_length_picks: {},
  match_interference_picks: {},
};

const emptyEliminatorPick: EliminatorPick = {
  entry_order: {},
  elimination_order: {},
  elimination_type: {},
  eliminated_by: {},
  winner_id: null,
  most_eliminations: null,
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

function PicksPageInner() {
  const searchParams = useSearchParams();
  const queryShowId = searchParams.get("show");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [shows, setShows] = useState<ShowRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eliminators, setEliminators] = useState<EliminatorRow[]>([]);
  const [selectedShowId, setSelectedShowId] = useState<string>("");
  const [entrants, setEntrants] = useState<EntrantRow[]>([]);
  const [rumbleEntries, setRumbleEntries] = useState<RumbleEntryRow[]>([]);
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
  const [payload, setPayload] = useState<PicksPayload>(emptyPayload);
  const [saving, setSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [rankInfo, setRankInfo] = useState<RankInfo>({ rank: null, total: 0 });
  const [customEntrantName, setCustomEntrantName] = useState("");
  const [entrantSearch, setEntrantSearch] = useState("");
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customModalEventId, setCustomModalEventId] = useState<string | null>(
    null,
  );
  const [stepIndex, setStepIndex] = useState(0);
  const hasAutoJumpedRef = useRef(false);
  const hasRestoredStepRef = useRef(false);
  const lastLoadedShowIdRef = useRef<string | null>(null);
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const picksLoadedForShowIdRef = useRef<string | null>(null);
  const isHydratingPayloadRef = useRef(false);
  const hasLocalEditsRef = useRef(false);
  const loadRumbleEntriesRef = useRef<() => void>(() => {});
  const loadMatchesRef = useRef<() => void>(() => {});
  const loadEliminatorsRef = useRef<() => Promise<EliminatorRow[] | void>>(
    async () => {}
  );
  const loadEliminatorEliminationsRef = useRef<
    (ids?: string[]) => void
  >(() => {});
  const loadMatchPickStatsRef = useRef<() => void>(() => {});
  const loadRankRef = useRef<() => void>(() => {});
  const keyPicksRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [editSection, setEditSection] = useState<EditSection>(null);
  const [focusedEventId, setFocusedEventId] = useState<string>("");
  const [isPicksLoading, setIsPicksLoading] = useState(false);

  const selectedShow = useMemo(
    () => shows.find((show) => show.id === selectedShowId) ?? null,
    [shows, selectedShowId],
  );
  const showEvents = useMemo(() => {
    return events
      .filter((event) => event.show_id === selectedShowId)
      .sort(
        (a, b) =>
          (a.order_index ?? 9999) - (b.order_index ?? 9999) ||
          a.name.localeCompare(b.name)
      );
  }, [events, selectedShowId]);
  const selectedPromotionImageUrl = useMemo(() => {
    if (!selectedShow?.promotion_id) return null;
    return (
      promotions.find((promotion) => promotion.id === selectedShow.promotion_id)
        ?.image_url ?? null
    );
  }, [promotions, selectedShow?.promotion_id]);
  const selectedPromotionName = useMemo(() => {
    if (!selectedShow?.promotion_id) return null;
    return (
      promotions.find((promotion) => promotion.id === selectedShow.promotion_id)
        ?.name ?? null
    );
  }, [promotions, selectedShow?.promotion_id]);
  const championshipBeltImageUrl = useMemo(() => {
    const matchWithBelt = matches.find(
      (row) => row.is_championship && row.championship_image_url
    );
    return matchWithBelt?.championship_image_url ?? null;
  }, [matches]);
  const visibleShowEvents = useMemo(() => {
    if (!focusedEventId) return showEvents;
    return showEvents.filter((event) => event.id === focusedEventId);
  }, [focusedEventId, showEvents]);
  const customModalEvent = useMemo(
    () => showEvents.find((event) => event.id === customModalEventId) ?? null,
    [customModalEventId, showEvents],
  );
  const isLocked = useMemo(() => {
    if (!selectedShow?.starts_at) return false;
    return new Date() >= new Date(selectedShow.starts_at);
  }, [selectedShow?.starts_at]);

  const lockStatusText = useMemo(() => {
    if (!selectedShow?.starts_at) {
      return "Lock time not set";
    }
    const startTime = new Date(selectedShow.starts_at).getTime();
    const diffMs = startTime - now;
    if (diffMs <= 0) {
      return "Show is locked";
    }
    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value: number) => String(value).padStart(2, "0");
    const parts = [
      days ? `${days}d` : null,
      hours ? `${pad(hours)}h` : null,
      minutes ? `${pad(minutes)}m` : null,
      `${pad(seconds)}s`,
    ].filter(Boolean);
    return `Picks lock in ${parts.join(" ")}`;
  }, [selectedShow?.starts_at, now]);

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
          const currentIsWwe =
            (current.promotion ?? "").toLowerCase() === "wwe";
          const nextIsWwe = (entrant.promotion ?? "").toLowerCase() === "wwe";
          if (!currentIsWwe && nextIsWwe) {
            byName.set(nameKey, entrant);
          }
        });
      byEvent[event.id] = Array.from(byName.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    });
    return byEvent;
  }, [entrants, showEvents, userId]);

  const entrantByIdAll = useMemo(() => {
    return new Map(entrants.map((entrant) => [entrant.id, entrant]));
  }, [entrants]);

  const getEventEntrants = useCallback(
    (eventId: string) => entrantOptionsByEvent[eventId] ?? [],
    [entrantOptionsByEvent],
  );

  const getRumblePick = useCallback(
    (eventId: string) => payload.rumbles[eventId] ?? emptyRumblePick,
    [payload.rumbles],
  );

  const getSelectedEntrantOptions = useCallback(
    (eventId: string) => {
      const current = getRumblePick(eventId);
      const selected = new Set(current.entrants);
      return getEventEntrants(eventId).filter((entrant) =>
        selected.has(entrant.id),
      );
    },
    [getEventEntrants, getRumblePick],
  );

  const getSelectedFinalFourOptions = useCallback(
    (eventId: string) => {
      const current = getRumblePick(eventId);
      const selected = new Set(current.final_four);
      return getEventEntrants(eventId).filter((entrant) =>
        selected.has(entrant.id),
      );
    },
    [getEventEntrants, getRumblePick],
  );

  const getFilteredEntrantsByPromotion = useCallback(
    (eventId: string) => {
      const entrantsForEvent = getEventEntrants(eventId);
      const grouped = entrantsForEvent.reduce(
        (groups, entrant) => {
          const key = entrant.promotion ?? "Other";
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(entrant);
          return groups;
        },
        {} as Record<string, EntrantRow[]>,
      );

      const query = entrantSearch.trim().toLowerCase();
      if (!query) {
        const count = entrantsForEvent.length;
        return { grouped, count };
      }

      const filtered: Record<string, EntrantRow[]> = {};
      Object.entries(grouped).forEach(([promotion, list]) => {
        const matches = list.filter((entrant) =>
          entrant.name.toLowerCase().includes(query),
        );
        if (matches.length > 0) {
          filtered[promotion] = matches;
        }
      });
      const count = Object.values(filtered).reduce(
        (total, list) => total + list.length,
        0,
      );
      return { grouped: filtered, count };
    },
    [entrantSearch, getEventEntrants],
  );

  const hasEntrantsForShow = useMemo(
    () => showEvents.some((event) => getEventEntrants(event.id).length > 0),
    [showEvents, getEventEntrants],
  );
  const hasEvents = showEvents.length > 0;
  const canShowRumbles = hasEvents && hasEntrantsForShow;

  const matchSidesByMatch = useMemo(() => {
    return matchSides.reduce(
      (map, side) => {
        if (!map[side.match_id]) {
          map[side.match_id] = [];
        }
        map[side.match_id].push(side);
        return map;
      },
      {} as Record<string, MatchSideRow[]>,
    );
  }, [matchSides]);

  const matchEntrantsByMatch = useMemo(() => {
    return matchEntrants.reduce(
      (map, row) => {
        if (!map[row.match_id]) {
          map[row.match_id] = [];
        }
        map[row.match_id].push(row);
        return map;
      },
      {} as Record<string, MatchEntrantRow[]>,
    );
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
        (entry) => entry.event_id === event.id,
      );
      const confirmedSet = new Set(
        eventEntries
          .filter((entry) => entry.is_confirmed)
          .map((entry) => entry.entrant_id),
      );
      const entrantSet = new Set(
        eventEntries
          .filter((entry) => !entry.is_confirmed)
          .map((entry) => entry.entrant_id),
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
      const winner = winnerReady ? winners[0].entrant_id : null;
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
      const ironPerson = winnerReady
        ? (event.iron_person_entrant_id ??
          [...eventEntries]
            .filter((entry) => entry.eliminated_at)
            .sort(
              (a, b) =>
                new Date(b.eliminated_at as string).getTime() -
                new Date(a.eliminated_at as string).getTime(),
            )[0]?.entrant_id ??
          null)
        : null;
      const ironPersonReady = Boolean(ironPerson);
      const maxElims = eventEntries.reduce(
        (max, entry) => Math.max(max, entry.eliminations_count ?? 0),
        0,
      );
      const topElims = new Set(
        eventEntries
          .filter((entry) => entry.eliminations_count === maxElims)
          .map((entry) => entry.entrant_id),
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
  }, [
    matches,
    payload.match_finish_picks,
    payload.match_picks,
    matchEntrantsByMatch,
  ]);

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
        actuals.entrantSet.has(id),
      ).length;
      const finalFourCorrect = actuals.finalFourReady
        ? pick.final_four.filter((id) => actuals.finalFourSet.has(id)).length
        : 0;
      const keyPicksTotal =
        (actuals.winnerReady && pick.winner && pick.winner === actuals.winner
          ? scoringRules.winner
          : 0) +
        (actuals.entry1Ready && pick.entry_1 && pick.entry_1 === actuals.entry1
          ? scoringRules.entry_1
          : 0) +
        (actuals.entry2Ready && pick.entry_2 && pick.entry_2 === actuals.entry2
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
        keyPicks:
          actuals.winnerReady ||
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
    if (!userId) return;
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
        .select(
          "id, name, status, rumble_gender, roster_year, show_id, iron_person_entrant_id, order_index",
        )
        .order("order_index", { ascending: true, nullsFirst: false })
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
        const storedShowId =
          typeof window !== "undefined"
            ? window.localStorage.getItem("bp:lastShowId")
            : null;
        const preferredShowId =
          queryShowId && showRows.some((show) => show.id === queryShowId)
            ? queryShowId
            : storedShowId && showRows.some((show) => show.id === storedShowId)
              ? storedShowId
              : showRows[0].id;
        setSelectedShowId((prev) => prev || preferredShowId);
      }
    });
  }, [queryShowId, userId]);

  useEffect(() => {
    if (!selectedShowId || typeof window === "undefined") return;
    window.localStorage.setItem("bp:lastShowId", selectedShowId);
  }, [selectedShowId]);

  useEffect(() => {
    if (!selectedShow?.starts_at) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
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
        "event_id, entrant_id, entry_number, eliminated_at, eliminations_count, is_confirmed",
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
        "id, name, kind, match_type, status, order_index, is_main_event, is_championship, championship_name, championship_image_url, winner_entrant_id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id, match_length, match_interference",
      )
      .eq("show_id", selectedShowId)
      .order("order_index", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (matchError) {
      setMessage(matchError.message);
      return;
    }
    const matchList = (matchRows ?? []) as MatchRow[];
    setMatches(matchList);

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

  const loadEliminators = useCallback(async () => {
    if (!selectedShowId) return;
    const { data: eliminatorRows, error: eliminatorError } = await supabase
      .from("eliminators")
      .select(
        "id, name, status, roster_year, roster_gender, entrant_limit, show_id, order_index"
      )
      .eq("show_id", selectedShowId)
      .order("order_index", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (eliminatorError) {
      setMessage(eliminatorError.message);
      return;
    }
    const eliminatorList = (eliminatorRows ?? []) as EliminatorRow[];
    setEliminators(eliminatorList);

    if (eliminatorList.length > 0) {
      const eliminatorIds = eliminatorList.map((row) => row.id);
      const { data: entryRows, error: entryError } = await supabase
        .from("eliminator_entries")
        .select("eliminator_id, entrant_id, entry_order")
        .in("eliminator_id", eliminatorIds);
      if (entryError) {
        setMessage(entryError.message);
        return;
      }
      setEliminatorEntries((entryRows ?? []) as EliminatorEntryRow[]);
    } else {
      setEliminatorEntries([]);
    }
    return eliminatorList;
  }, [selectedShowId]);

  const loadEliminatorEliminations = useCallback(async (ids?: string[]) => {
    if (!selectedShowId) return;
    const eliminatorIds = ids ?? eliminators.map((row) => row.id);
    if (eliminatorIds.length === 0) {
      setEliminatorEliminations([]);
      return;
    }
    const { data: elimRows, error: elimError } = await supabase
      .from("eliminator_eliminations")
      .select(
        "eliminator_id, eliminated_entrant_id, eliminated_by_entrant_id, elimination_type, elimination_order",
      )
      .in("eliminator_id", eliminatorIds);
    if (elimError) {
      setMessage(elimError.message);
      return;
    }
    setEliminatorEliminations((elimRows ?? []) as EliminatorEliminationRow[]);
  }, [eliminators, selectedShowId]);

  const loadMatchPickStats = useCallback(async () => {
    if (!selectedShowId) return;
    const { data, error } = await supabase
      .from("picks")
      .select("match_picks:payload->match_picks")
      .eq("show_id", selectedShowId);
    if (error) {
      setMessage(error.message);
      return;
    }
    const nextStats: Record<
      string,
      { total: number; bySide: Record<string, number> }
    > = {};
    (data ?? []).forEach((row) => {
      const matchPicks =
        (row as { match_picks?: Record<string, string | null> }).match_picks ??
        {};
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
  }, [selectedShowId]);

  useEffect(() => {
    if (!selectedShowId || !userId) return;
    const showChanged = lastLoadedShowIdRef.current !== selectedShowId;
    const userChanged = lastLoadedUserIdRef.current !== userId;
    const hasLoadedForShow = picksLoadedForShowIdRef.current === selectedShowId;
    if (!showChanged && !userChanged && hasLoadedForShow) {
      return;
    }
    lastLoadedShowIdRef.current = selectedShowId;
    lastLoadedUserIdRef.current = userId;
    const needsSkeleton = picksLoadedForShowIdRef.current !== selectedShowId;
    setMessage(null);
    if (showChanged) {
      setPayload(emptyPayload);
      setHasSaved(false);
      setEditSection(null);
      setFocusedEventId("");
      hasLocalEditsRef.current = false;
    }
    if (needsSkeleton) {
      setIsPicksLoading(true);
    }

    const loadShowData = async () => {
      try {
        const [{ data: pickRows }, { data: entrantRows, error: entrantError }] =
          await Promise.all([
          supabase
            .from("picks")
            .select(
              "updated_at, rumbles:payload->rumbles, eliminators:payload->eliminators, match_picks:payload->match_picks, match_finish_picks:payload->match_finish_picks, match_length_picks:payload->match_length_picks, match_interference_picks:payload->match_interference_picks"
            )
            .eq("show_id", selectedShowId)
            .eq("user_id", userId)
            .maybeSingle(),
            supabase
              .from("entrants")
              .select(
                "id, name, promotion, gender, image_url, logo_url, roster_year, event_id, is_custom, created_by, status",
              )
              .order("name", { ascending: true }),
          ]);

        if (entrantError) {
          setMessage(entrantError.message);
          return;
        }

        setEntrants(entrantRows ?? []);
        loadRumbleEntriesRef.current();
        const eliminatorList = (await loadEliminatorsRef.current()) ?? [];
        loadEliminatorEliminationsRef.current(
          eliminatorList.map((item) => item.id)
        );
        await loadMatchesRef.current();
        loadMatchPickStatsRef.current();
        loadRankRef.current();

        let savedPayload = pickRows
          ? ({
              rumbles: pickRows.rumbles ?? {},
              eliminators: pickRows.eliminators ?? {},
              match_picks: pickRows.match_picks ?? {},
              match_finish_picks: pickRows.match_finish_picks ?? {},
              match_length_picks: pickRows.match_length_picks ?? {},
              match_interference_picks: pickRows.match_interference_picks ?? {},
            } as Partial<PicksPayload>)
          : null;
        const savedUpdatedAt =
          pickRows?.updated_at ? Date.parse(pickRows.updated_at) : 0;
        if (draftKey && typeof window !== "undefined") {
          try {
            const draftRaw = window.localStorage.getItem(draftKey);
            if (draftRaw) {
              const parsed = JSON.parse(draftRaw) as {
                payload?: Partial<PicksPayload>;
                updatedAt?: number;
              };
              const draftUpdatedAt = parsed.updatedAt ?? 0;
              if (!savedPayload || draftUpdatedAt > savedUpdatedAt) {
                savedPayload = parsed.payload ?? null;
              }
            }
          } catch (error) {
            console.warn("Failed to restore draft picks", error);
          }
        }
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
        const nextEliminators: Record<string, typeof emptyEliminatorPick> = {};
        const existingEliminators = savedPayload?.eliminators ?? {};
        eliminatorList.forEach((eliminator) => {
          const base = {
            ...emptyEliminatorPick,
            ...(existingEliminators[eliminator.id] ?? {}),
          };
          nextEliminators[eliminator.id] = {
            ...base,
          };
        });

        if (savedPayload) {
          if (hasLocalEditsRef.current) return;
          isHydratingPayloadRef.current = true;
          setPayload({
            rumbles: nextRumbles,
            eliminators: nextEliminators,
            match_picks:
              (savedPayload.match_picks as Record<string, string | null>) ?? {},
            match_finish_picks:
              (savedPayload.match_finish_picks as Record<
                string,
                {
                  method: string | null;
                  winner: string | null;
                  loser: string | null;
                }
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
          isHydratingPayloadRef.current = false;
          setHasSaved(true);
        } else {
          if (hasLocalEditsRef.current) return;
          isHydratingPayloadRef.current = true;
          setPayload({
            rumbles: nextRumbles,
            eliminators: nextEliminators,
            match_picks: {},
            match_finish_picks: {},
            match_length_picks: {},
            match_interference_picks: {},
          });
          isHydratingPayloadRef.current = false;
        }
      } finally {
        setIsPicksLoading(false);
        picksLoadedForShowIdRef.current = selectedShowId;
      }
    };

    loadShowData();
  }, [
    selectedShowId,
    userId,
  ]);

  useEffect(() => {
    if (isHydratingPayloadRef.current) return;
    if (isPicksLoading) return;
    hasLocalEditsRef.current = true;
  }, [isPicksLoading, payload]);

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
    loadRumbleEntriesRef.current = loadRumbleEntries;
  }, [loadRumbleEntries]);

  useEffect(() => {
    loadMatchesRef.current = loadMatches;
  }, [loadMatches]);

  useEffect(() => {
    loadEliminatorsRef.current = loadEliminators;
  }, [loadEliminators]);

  useEffect(() => {
    loadEliminatorEliminationsRef.current = loadEliminatorEliminations;
  }, [loadEliminatorEliminations]);

  useEffect(() => {
    loadMatchPickStatsRef.current = loadMatchPickStats;
  }, [loadMatchPickStats]);

  useEffect(() => {
    loadRankRef.current = loadRank;
  }, [loadRank]);

  useEffect(() => {
    setPayload((prev) => {
      const matchIdSet = new Set(matches.map((match) => match.id));
      const eliminatorIdSet = new Set(eliminators.map((item) => item.id));
      const matchPicks = Object.fromEntries(
        Object.entries(prev.match_picks ?? {}).filter(([matchId]) =>
          matchIdSet.has(matchId),
        ),
      );
      const matchFinishPicks = Object.fromEntries(
        Object.entries(prev.match_finish_picks ?? {}).filter(([matchId]) =>
          matchIdSet.has(matchId),
        ),
      );
      const matchLengthPicks = Object.fromEntries(
        Object.entries(prev.match_length_picks ?? {}).filter(([matchId]) =>
          matchIdSet.has(matchId),
        ),
      );
      const matchInterferencePicks = Object.fromEntries(
        Object.entries(prev.match_interference_picks ?? {}).filter(
          ([matchId]) => matchIdSet.has(matchId),
        ),
      );
      const eliminatorPicks = Object.fromEntries(
        Object.entries(prev.eliminators ?? {}).filter(([eliminatorId]) =>
          eliminatorIdSet.has(eliminatorId),
        ),
      );

      const nextRumbles: Record<string, RumblePick> = {};
      showEvents.forEach((event) => {
        const current = prev.rumbles[event.id] ?? emptyRumblePick;
        const confirmedSet = confirmedEntrantsByEvent[event.id] ?? new Set();
        const selected = new Set([
          ...current.entrants,
          ...Array.from(confirmedSet),
        ]);
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
        eliminators: eliminatorPicks,
        match_picks: matchPicks,
        match_finish_picks: matchFinishPicks,
        match_length_picks: matchLengthPicks,
        match_interference_picks: matchInterferencePicks,
      };
    });
  }, [matches, showEvents, confirmedEntrantsByEvent, eliminators]);

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
      (entrant) => entrant.name.trim().toLowerCase() === normalized,
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
      .select(
        "id, name, promotion, gender, image_url, logo_url, roster_year, event_id, is_custom, created_by, status",
      )
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
      { onConflict: "user_id,show_id" },
    );
    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }
    setHasSaved(true);
    setEditSection(null);
    setFocusedEventId("");
    setSaving(false);
  };

  const handleEditEventSection = (
    section: Exclude<EditSection, "matches" | null>,
    eventId: string,
  ) => {
    setFocusedEventId(eventId);
    setEditSection(section);
  };

  const stepItems = useMemo(() => {
    const eventItems = showEvents.map((event) => ({
      type: "event" as const,
      id: event.id,
      order_index: event.order_index ?? null,
      name: event.name,
    }));
    const eliminatorItems = eliminators.map((eliminator) => ({
      type: "eliminator" as const,
      id: eliminator.id,
      order_index: eliminator.order_index ?? null,
      name: eliminator.name,
    }));
    const matchItems = matches.map((match) => ({
      type: "match" as const,
      id: match.id,
      order_index: match.order_index ?? null,
      name: match.name,
    }));
    return [...eventItems, ...eliminatorItems, ...matchItems].sort(
      (a, b) =>
        (a.order_index ?? 9999) - (b.order_index ?? 9999) ||
        a.name.localeCompare(b.name)
    );
  }, [matches, showEvents, eliminators]);
  const stepIndexById = useMemo(() => {
    const map = new Map<string, number>();
    stepItems.forEach((item, index) => {
      map.set(`${item.type}:${item.id}`, index);
    });
    return map;
  }, [stepItems]);
  const totalSteps = stepItems.length;
  const currentStep =
    stepItems[Math.min(stepIndex, Math.max(totalSteps - 1, 0))];
  const progressPercent =
    totalSteps > 0 ? Math.round(((stepIndex + 1) / totalSteps) * 100) : 0;
  const loadingStepType: "event" | "match" | "eliminator" =
    currentStep?.type ?? "match";

  const draftKey = useMemo(() => {
    if (!selectedShowId || !userId) return null;
    return `picks:draft:${selectedShowId}:${userId}`;
  }, [selectedShowId, userId]);

  const lastStepKey = useMemo(() => {
    if (!selectedShowId || !userId) return null;
    return `picks:lastStep:${selectedShowId}:${userId}`;
  }, [selectedShowId, userId]);

  useEffect(() => {
    hasAutoJumpedRef.current = false;
    hasRestoredStepRef.current = false;
  }, [selectedShowId, totalSteps]);

  useEffect(() => {
    if (!lastStepKey) return;
    if (typeof window === "undefined") return;
    if (stepIndex >= totalSteps) {
      window.localStorage.setItem(lastStepKey, "complete");
      return;
    }
    if (!currentStep) return;
    window.localStorage.setItem(
      lastStepKey,
      `${currentStep.type}:${currentStep.id}`
    );
  }, [currentStep, lastStepKey, stepIndex, totalSteps]);

  useEffect(() => {
    if (!draftKey) return;
    if (typeof window === "undefined") return;
    if (isHydratingPayloadRef.current) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ payload, updatedAt: Date.now() })
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftKey, payload]);

  const scrollToTop = () => {
    if (typeof window === "undefined") return;
    const scrollEl = document.scrollingElement ?? document.documentElement;
    scrollEl.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(() => {
      scrollEl.scrollTo({ top: 0, behavior: "smooth" });
    });
    setTimeout(() => {
      scrollEl.scrollTo({ top: 0, behavior: "auto" });
    }, 200);
  };

  const handleStepContinue = async () => {
    await handleSave();
    setStepIndex((prev) => Math.min(prev + 1, totalSteps));
    scrollToTop();
  };

  const currentStepMatchReady =
    currentStep?.type !== "match" ||
    Boolean(payload.match_picks[currentStep.id]);

  const allStepsComplete = useMemo(() => {
    if (!selectedShowId) return false;
    if (stepItems.length === 0) return false;
    const isEventComplete = (eventId: string) => {
      const pick = payload.rumbles[eventId] ?? emptyRumblePick;
      return (
        pick.entrants.length >= 30 &&
        pick.final_four.length === 4 &&
        Boolean(pick.winner) &&
        Boolean(pick.entry_1) &&
        Boolean(pick.entry_2) &&
        Boolean(pick.entry_30) &&
        Boolean(pick.iron_person) &&
        Boolean(pick.most_eliminations)
      );
    };
    const isEliminatorComplete = (eliminatorId: string) => {
      const pick = payload.eliminators?.[eliminatorId] ?? emptyEliminatorPick;
      if (!pick.winner_id || !pick.most_eliminations) return false;
      const entriesForEliminator = eliminatorEntries.filter(
        (entry) => entry.eliminator_id === eliminatorId
      );
      if (entriesForEliminator.length === 0) return false;
      return entriesForEliminator.every((entry) => {
        const id = entry.entrant_id;
        if (!pick.entry_order?.[id]) return false;
        if (pick.winner_id === id) return true;
        return (
          Boolean(pick.elimination_order?.[id]) &&
          Boolean(pick.elimination_type?.[id]) &&
          Boolean(pick.eliminated_by?.[id])
        );
      });
    };
    const isMatchComplete = (matchId: string) => {
      const match = matches.find((item) => item.id === matchId);
      const hasWinnerPick = Boolean(payload.match_picks[matchId]);
      if (!hasWinnerPick) return false;
      const finishPick = payload.match_finish_picks[matchId] ?? {
        method: null,
        winner: null,
        loser: null,
      };
      const lengthPick = payload.match_length_picks?.[matchId] ?? null;
      const interferencePick = payload.match_interference_picks?.[matchId] ?? null;
      const matchType = match?.match_type ?? "singles";
      const isSingles = matchType === "singles";
      const isTripleOrFatal =
        matchType === "triple_threat" || matchType === "fatal_4_way";
      const showFinishWinner = !isSingles && !isTripleOrFatal;
      const showFinishLoser = !isSingles;
      const finishRequiresEntrants =
        finishPick.method === "pinfall" || finishPick.method === "submission";
      const hasFinishWinner =
        !finishRequiresEntrants || !showFinishWinner || Boolean(finishPick.winner);
      const hasFinishLoser =
        !finishRequiresEntrants || !showFinishLoser || Boolean(finishPick.loser);
      return Boolean(finishPick.method) &&
        Boolean(lengthPick) &&
        Boolean(interferencePick) &&
        hasFinishWinner &&
        hasFinishLoser;
    };
    return stepItems.every((item) => {
      if (item.type === "match") {
        return isMatchComplete(item.id);
      }
      if (item.type === "event") {
        return isEventComplete(item.id);
      }
      return isEliminatorComplete(item.id);
    });
  }, [
    eliminatorEntries,
    matches,
    payload.eliminators,
    payload.match_finish_picks,
    payload.match_interference_picks,
    payload.match_length_picks,
    payload.match_picks,
    payload.rumbles,
    selectedShowId,
    stepItems,
  ]);

  useEffect(() => {
    if (!lastStepKey || totalSteps === 0) return;
    if (hasRestoredStepRef.current) return;
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(lastStepKey);
    if (!saved) {
      setStepIndex(0);
      hasRestoredStepRef.current = true;
      return;
    }
    if (saved === "complete") {
      if (allStepsComplete) {
        setStepIndex(totalSteps);
      } else {
        window.localStorage.removeItem(lastStepKey);
        setStepIndex(0);
      }
      hasRestoredStepRef.current = true;
      return;
    }
    const savedIndex = stepIndexById.get(saved);
    setStepIndex(savedIndex ?? 0);
    hasRestoredStepRef.current = true;
  }, [allStepsComplete, lastStepKey, totalSteps, stepIndexById]);

  useEffect(() => {
    if (hasAutoJumpedRef.current) return;
    if (!allStepsComplete) return;
    setStepIndex(totalSteps);
    hasAutoJumpedRef.current = true;
  }, [allStepsComplete, totalSteps]);

  const renderStepSkeleton = (type: "event" | "match" | "eliminator") => {
    if (type === "event") {
      return (
        <div className="mt-6 space-y-6">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <div className="h-4 w-32 rounded-full bg-zinc-800/80" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-10 rounded-2xl bg-zinc-800/60"
                />
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <div className="h-4 w-28 rounded-full bg-zinc-800/80" />
            <div className="mt-4 flex gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-12 w-12 rounded-full bg-zinc-800/60"
                />
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <div className="h-4 w-24 rounded-full bg-zinc-800/80" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-9 rounded-2xl bg-zinc-800/60"
                />
              ))}
            </div>
          </div>
        </div>
      );
    }
    if (type === "eliminator") {
      return (
        <div className="mt-6 space-y-4">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <div className="h-4 w-36 rounded-full bg-zinc-800/80" />
            <div className="mt-4 h-10 w-1/2 rounded-2xl bg-zinc-800/60" />
          </div>
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-zinc-800/70" />
                <div className="h-4 w-40 rounded-full bg-zinc-800/70" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="h-9 rounded-2xl bg-zinc-800/60" />
                <div className="h-9 rounded-2xl bg-zinc-800/60" />
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="h-4 w-28 rounded-full bg-zinc-800/80" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="h-48 rounded-2xl bg-zinc-800/60 sm:h-60" />
            <div className="h-48 rounded-2xl bg-zinc-800/60 sm:h-60" />
          </div>
        </div>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="h-4 w-36 rounded-full bg-zinc-800/80" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="h-9 rounded-2xl bg-zinc-800/60" />
            <div className="h-9 rounded-2xl bg-zinc-800/60" />
          </div>
        </div>
      </div>
    );
  };

  if (loading) {

    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto w-full max-w-6xl px-6 py-6 pb-28 sm:py-10 sm:pb-32">
          <div className="animate-pulse">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="h-3 w-32 rounded-full bg-zinc-800/80" />
              <div className="flex items-center justify-center gap-3">
                <div className="h-10 w-10 rounded-full bg-zinc-800/80" />
                <div className="h-7 w-48 rounded-full bg-zinc-800/80 sm:h-8" />
              </div>
              <div className="h-4 w-56 rounded-full bg-zinc-800/80" />
            </div>
            {renderStepSkeleton(loadingStepType)}
          </div>
        </main>
      </div>
    );
  }

  if (isPicksLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto w-full max-w-6xl px-6 py-6 pb-28 sm:py-10 sm:pb-32">
          <div className="animate-pulse">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="h-3 w-32 rounded-full bg-zinc-800/80" />
              <div className="flex items-center justify-center gap-3">
                <div className="h-10 w-10 rounded-full bg-zinc-800/80" />
                <div className="h-7 w-48 rounded-full bg-zinc-800/80 sm:h-8" />
              </div>
              <div className="h-4 w-56 rounded-full bg-zinc-800/80" />
            </div>
            {renderStepSkeleton(loadingStepType)}
          </div>
        </main>
      </div>
    );
  }

  if (!userId) {
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
      <main className="mx-auto w-full max-w-6xl px-6 py-6 pb-28 sm:py-10 sm:pb-32">
        <div className="relative pb-2 sm:pb-3">
          <div className="relative z-10 flex flex-col items-center gap-1 text-center">
            {selectedPromotionName ? (
              <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-zinc-500">
                {selectedPromotionName}
              </span>
            ) : null}
            <div className="flex items-center justify-center gap-3">
              {selectedPromotionImageUrl ? (
                <span className="flex h-10 w-10 min-h-10 min-w-10 shrink-0 aspect-square items-center justify-center overflow-hidden rounded-full border border-amber-400/40 bg-black/40">
                  <Image
                    src={selectedPromotionImageUrl}
                    alt={selectedShow?.name ?? "Promotion"}
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                  />
                </span>
              ) : null}
              <span className="bg-gradient-to-b from-white via-amber-100 to-amber-200 bg-clip-text text-2xl font-semibold text-transparent drop-shadow-[0_0_12px_rgba(251,196,0,0.35)] sm:text-3xl">
                {selectedShow?.name ?? "Show"}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-amber-200">
              <span className="text-sm leading-none">🔒</span>
              <span>{lockStatusText}</span>
            </div>
            {stepIndex < totalSteps &&
              currentStep?.type === "match" &&
              matches.some(
                (match) => match.id === currentStep.id && match.is_main_event
              ) && (
                <div className="mt-3">
                  <span className="rounded-full border border-amber-300/40 bg-black px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-amber-100">
                    Main event
                  </span>
                </div>
              )}
          </div>
          <div className="relative z-10 mt-2">
            <MessageBanner message={message} />
          </div>
        </div>

        {hasEvents && !hasEntrantsForShow && (
          <section className="mt-0 p-0">
            <p className="text-sm text-zinc-400">
              No entrants are available yet.
            </p>
          </section>
        )}
        {totalSteps === 0 ? (
          <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <p className="text-sm text-zinc-400">
              No matches or events are available yet.
            </p>
          </section>
        ) : stepIndex >= totalSteps ? (
          <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-xl font-semibold text-zinc-100">
              All picks are in
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              You can edit your picks until the show starts.
            </p>
            <div className="mt-6 space-y-4">
              {[...showEvents, ...eliminators, ...matches]
                .map((item) => ({
                  type: ("match_type" in item
                    ? "match"
                    : "entrant_limit" in item
                      ? "eliminator"
                      : "event") as "event" | "match" | "eliminator",
                  id: item.id,
                  order_index: item.order_index ?? null,
                  name: item.name,
                }))
                .sort(
                  (a, b) =>
                    (a.order_index ?? 9999) - (b.order_index ?? 9999) ||
                    a.name.localeCompare(b.name)
                )
                .map((item) => {
                  if (item.type === "event") {
                    const event = showEvents.find((row) => row.id === item.id);
                    if (!event) return null;
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
                      <div
                        key={`event:${event.id}`}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                            {event.name}
                          </p>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition hover:border-amber-400 hover:text-amber-200"
                            onClick={() =>
                              setStepIndex(
                                stepIndexById.get(`event:${event.id}`) ?? 0,
                              )
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
                            <Image
                              src={winnerEntrant.image_url}
                              alt={winnerEntrant.name}
                              width={28}
                              height={28}
                              className="h-7 w-7 rounded-full border border-zinc-700 object-cover"
                            />
                          ) : null}
                          <span>{winner || "Not set"}</span>
                        </div>
                      </div>
                    );
                  }
                  if (item.type === "eliminator") {
                    const eliminator = eliminators.find(
                      (row) => row.id === item.id,
                    );
                    if (!eliminator) return null;
                    const pick =
                      payload.eliminators?.[eliminator.id] ??
                      emptyEliminatorPick;
                    const entriesForEliminator = eliminatorEntries.filter(
                      (entry) => entry.eliminator_id === eliminator.id,
                    );
                    const entryOrder = entriesForEliminator
                      .map((entry) => {
                        const entrant = entrantByIdAll.get(entry.entrant_id);
                        const order = pick.entry_order?.[entry.entrant_id];
                        return order
                          ? `${order}. ${entrant?.name ?? "Entrant"}`
                          : null;
                      })
                      .filter(Boolean)
                      .sort((a, b) => {
                        const aValue = a ? Number(a.split(".")[0]) : 0;
                        const bValue = b ? Number(b.split(".")[0]) : 0;
                        return aValue - bValue;
                      })
                      .join(", ");
                    const eliminationOrder = entriesForEliminator
                      .map((entry) => {
                        const entrant = entrantByIdAll.get(entry.entrant_id);
                        const order = pick.elimination_order?.[entry.entrant_id];
                        return order
                          ? `${order}. ${entrant?.name ?? "Entrant"}`
                          : null;
                      })
                      .filter(Boolean)
                      .sort((a, b) => {
                        const aValue = a ? Number(a.split(".")[0]) : 0;
                        const bValue = b ? Number(b.split(".")[0]) : 0;
                        return aValue - bValue;
                      })
                      .join(", ");
                    const mostElims = pick.most_eliminations
                      ? entrantByIdAll.get(pick.most_eliminations)?.name
                      : null;
                    const winnerPick = pick.winner_id
                      ? entrantByIdAll.get(pick.winner_id)?.name
                      : null;
                    return (
                      <div
                        key={`eliminator:${eliminator.id}`}
                        className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                            {eliminator.name}
                          </p>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition hover:border-amber-400 hover:text-amber-200"
                            onClick={() =>
                              setStepIndex(
                                stepIndexById.get(
                                  `eliminator:${eliminator.id}`,
                                ) ?? 0,
                              )
                            }
                            aria-label={`Edit ${eliminator.name}`}
                          >
                            ✎
                          </button>
                        </div>
                        <p className="mt-2 text-sm text-zinc-300">
                          <span className="font-semibold text-zinc-100">
                            Entry order:
                          </span>{" "}
                          {entryOrder || "Not set"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">
                          <span className="font-semibold text-zinc-100">
                            Elimination order:
                          </span>{" "}
                          {eliminationOrder || "Not set"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">
                          <span className="font-semibold text-zinc-100">
                            Winner pick:
                          </span>{" "}
                          {winnerPick || "Not set"}
                        </p>
                        <p className="mt-1 text-sm text-zinc-300">
                          <span className="font-semibold text-zinc-100">
                            Most eliminations:
                          </span>{" "}
                          {mostElims || "Not set"}
                        </p>
                      </div>
                    );
                  }
                  const match = matches.find((row) => row.id === item.id);
                  if (!match) return null;
                  const winnerSideId = payload.match_picks[match.id] ?? null;
                  const sideEntrants = matchEntrantsByMatch[match.id] ?? [];
                  const sides = matchSidesByMatch[match.id] ?? [];
                  const winnerSide =
                    sides.find((side) => side.id === winnerSideId) ?? null;
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
                    <div
                      key={`match:${match.id}`}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                          {match.name}
                        </p>
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition hover:border-amber-400 hover:text-amber-200"
                          onClick={() =>
                            setStepIndex(
                              stepIndexById.get(`match:${match.id}`) ?? 0,
                            )
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
                                <Image
                                  key={entrant.id}
                                  src={entrant.image_url}
                                  alt={entrant.name}
                                  width={28}
                                  height={28}
                                  className="h-7 w-7 rounded-full border border-zinc-700 object-cover"
                                />
                              ) : (
                                <div
                                  key={entrant.id}
                                  className="h-7 w-7 rounded-full border border-zinc-700 bg-zinc-800"
                                />
                              ),
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
          <>
            {currentStep?.type === "event" && canShowRumbles ? (
              <>
                {showEvents
                  .filter((event) => event.id === currentStep.id)
                  .map((event) => {
                    const eventPick = getRumblePick(event.id);
                    const { grouped, count } = getFilteredEntrantsByPromotion(
                      event.id,
                    );
                    const selectedEntrants = getSelectedEntrantOptions(
                      event.id,
                    );
                    const selectedFinalFour = getSelectedFinalFourOptions(
                      event.id,
                    );
                    return (
                      <div key={event.id} className="mt-3 space-y-6">
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
                              const current =
                                prev.rumbles[event.id] ?? emptyRumblePick;
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
            ) : currentStep?.type === "eliminator" ? (
              <div className="mt-3">
                {eliminators
                  .filter((eliminator) => eliminator.id === currentStep.id)
                  .map((eliminator) => (
                    <EliminatorPicksSection
                      key={eliminator.id}
                      eliminator={eliminator}
                      entries={eliminatorEntries.filter(
                        (entry) => entry.eliminator_id === eliminator.id,
                      )}
                      entrantByIdAll={entrantByIdAll}
                      payload={payload}
                      setPayload={setPayload}
                      isLocked={isLocked}
                    />
                  ))}
              </div>
            ) : (
              <>
                {matches
                  .filter((match) => match.id === currentStep?.id)
                  .map((match) => (
                    <div
                      key={match.id}
                      className="mt-3"
                    >
                      <MatchPicksSection
                        matches={[match]}
                        matchSidesByMatch={matchSidesByMatch}
                        matchEntrantsByMatch={matchEntrantsByMatch}
                        entrantByIdAll={entrantByIdAll}
                        matchPickStats={matchPickStats}
                        payload={payload}
                        setPayload={setPayload}
                        isLocked={isLocked}
                        hasSaved={false}
                        onCancel={() => undefined}
                        onSave={handleSave}
                        saving={saving}
                      />
                    </div>
                  ))}
              </>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 px-6 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={() => {
                  setStepIndex((prev) => Math.max(prev - 1, 0));
                  scrollToTop();
                }}
                disabled={stepIndex === 0}
              >
                Back
              </button>
              <button
                className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-xs font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                type="button"
                onClick={handleStepContinue}
                disabled={saving || isLocked || !currentStepMatchReady}
              >
                {stepIndex + 1 === totalSteps ? "Finish picks" : "Save & next"}
              </button>
            </div>
          </>
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
      {totalSteps > 0 && stepIndex < totalSteps && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 px-6 py-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2">
            <div className="flex items-center justify-center text-[11px] uppercase tracking-[0.3em] text-zinc-500">
              <span>
                Step {stepIndex + 1} of {totalSteps}
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PicksPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-200">
          <main className="mx-auto w-full max-w-6xl px-6 py-6 pb-28 sm:py-10 sm:pb-32">
            <div className="animate-pulse">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="h-3 w-32 rounded-full bg-zinc-800/80" />
                <div className="flex items-center justify-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-zinc-800/80" />
                  <div className="h-7 w-48 rounded-full bg-zinc-800/80 sm:h-8" />
                </div>
                <div className="h-4 w-56 rounded-full bg-zinc-800/80" />
              </div>
              <div className="mt-6 space-y-4">
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                  <div className="h-4 w-28 rounded-full bg-zinc-800/80" />
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="h-48 rounded-2xl bg-zinc-800/60 sm:h-60" />
                    <div className="h-48 rounded-2xl bg-zinc-800/60 sm:h-60" />
                  </div>
                </div>
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                  <div className="h-4 w-36 rounded-full bg-zinc-800/80" />
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="h-9 rounded-2xl bg-zinc-800/60" />
                    <div className="h-9 rounded-2xl bg-zinc-800/60" />
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      }
    >
      <PicksPageInner />
    </Suspense>
  );
}
