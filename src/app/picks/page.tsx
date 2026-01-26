"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { EntrantCard } from "../../components/EntrantCard";
import { scoringRules } from "../../lib/scoringRules";

type EventRow = {
  id: string;
  name: string;
  starts_at: string | null;
  status: string;
  rumble_gender: string | null;
  roster_year: number | null;
  show_id: string | null;
};

type ShowRow = {
  id: string;
  name: string;
  starts_at: string | null;
  status: string;
};

type EntrantRow = {
  id: string;
  name: string;
  promotion: string | null;
  gender: string | null;
  image_url: string | null;
  roster_year: number | null;
  event_id: string | null;
  is_custom: boolean;
  created_by: string | null;
  status: string | null;
};

type RumblePick = {
  entrants: string[];
  final_four: string[];
  winner: string | null;
  entry_1: string | null;
  entry_2: string | null;
  entry_30: string | null;
  most_eliminations: string | null;
};

type PicksPayload = {
  rumbles: Record<string, RumblePick>;
  match_picks: Record<string, string | null>;
  match_finish_picks: Record<
    string,
    { method: string | null; winner: string | null; loser: string | null }
  >;
};

type RumbleEntryRow = {
  event_id: string;
  entrant_id: string;
  entry_number: number | null;
  eliminated_at: string | null;
  eliminations_count: number;
};

type MatchRow = {
  id: string;
  name: string;
  kind: string;
  match_type: string;
  status: string;
  winner_entrant_id: string | null;
  winner_side_id: string | null;
  finish_method: string | null;
  finish_winner_entrant_id: string | null;
  finish_loser_entrant_id: string | null;
};

type MatchEntrantRow = {
  match_id: string;
  entrant_id: string;
  side_id: string | null;
};

type MatchSideRow = {
  id: string;
  match_id: string;
  label: string | null;
};

type EventActuals = {
  entrantSet: Set<string>;
  finalFourSet: Set<string>;
  winner: string | null;
  entry1: string | null;
  entry2: string | null;
  entry30: string | null;
  topElims: Set<string>;
  hasData: boolean;
};

const SCORING_POLL_INTERVAL_MS = 15000;

const emptyRumblePick: RumblePick = {
  entrants: [],
  final_four: [],
  winner: null,
  entry_1: null,
  entry_2: null,
  entry_30: null,
  most_eliminations: null,
};

const emptyPayload: PicksPayload = {
  rumbles: {},
  match_picks: {},
  match_finish_picks: {},
};

const emptyActuals: EventActuals = {
  entrantSet: new Set(),
  finalFourSet: new Set(),
  winner: null,
  entry1: null,
  entry2: null,
  entry30: null,
  topElims: new Set(),
  hasData: false,
};

export default function PicksPage() {
  const searchParams = useSearchParams();
  const queryShowId = searchParams.get("show");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [shows, setShows] = useState<ShowRow[]>([]);
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
  const [rankInfo, setRankInfo] = useState<{ rank: number | null; total: number }>(
    { rank: null, total: 0 }
  );
  const [customEntrantName, setCustomEntrantName] = useState("");
  const [entrantSearch, setEntrantSearch] = useState("");
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customModalEventId, setCustomModalEventId] = useState<string | null>(null);
  const keyPicksRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [editSection, setEditSection] = useState<
    "entrants" | "final_four" | "key_picks" | "matches" | null
  >(null);

  const selectedShow = useMemo(
    () => shows.find((show) => show.id === selectedShowId) ?? null,
    [shows, selectedShowId]
  );
  const showEvents = useMemo(
    () => events.filter((event) => event.show_id === selectedShowId),
    [events, selectedShowId]
  );
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
        detail: "Picks stay editable until a start time is added.",
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
        detail: "You can edit picks until the show start time.",
      };
    }
    return {
      label: `Locked ${timeString} ago`,
      detail: "Picks are locked once the show starts.",
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
      const entrantSet = new Set(eventEntries.map((entry) => entry.entrant_id));
      const finalFour = [...eventEntries]
        .sort((a, b) => getEliminationKey(b) - getEliminationKey(a))
        .slice(0, 4)
        .map((entry) => entry.entrant_id);
      const winners = eventEntries.filter((entry) => !entry.eliminated_at);
      const winner =
        eventEntries.length >= 30 && winners.length === 1
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
        finalFourSet: new Set(finalFour),
        winner,
        entry1,
        entry2,
        entry30,
        topElims,
        hasData: eventEntries.length > 0,
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
      if (entrantCount > 2 && match.finish_method) {
        const finishPick = payload.match_finish_picks[match.id];
        if (finishPick?.method === match.finish_method) {
          total += scoringRules.match_finish_method;
          if (
            (match.finish_method === "pinfall" ||
              match.finish_method === "submission") &&
            finishPick.method === match.finish_method
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
    const byEvent: Record<
      string,
      { entrants: number | null; finalFour: number | null; keyPicks: number | null }
    > = {};
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
      const finalFourCorrect = pick.final_four.filter((id) =>
        actuals.finalFourSet.has(id)
      ).length;
      const keyPicksTotal =
        (pick.winner && pick.winner === actuals.winner
          ? scoringRules.winner
          : 0) +
        (pick.entry_1 && pick.entry_1 === actuals.entry1
          ? scoringRules.entry_1
          : 0) +
        (pick.entry_2 && pick.entry_2 === actuals.entry2
          ? scoringRules.entry_2
          : 0) +
        (pick.entry_30 && pick.entry_30 === actuals.entry30
          ? scoringRules.entry_30
          : 0) +
        (pick.most_eliminations && actuals.topElims.has(pick.most_eliminations)
          ? scoringRules.most_eliminations
          : 0);

      byEvent[event.id] = {
        entrants: entrantsCorrect * scoringRules.entrants,
        finalFour: finalFourCorrect * scoringRules.final_four,
        keyPicks: keyPicksTotal,
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
        .select("id, name, starts_at, status")
        .order("starts_at", { ascending: true }),
      supabase
        .from("events")
        .select("id, name, starts_at, status, rumble_gender, roster_year, show_id")
        .order("starts_at", { ascending: true }),
    ]).then(([showsResult, eventsResult]) => {
      if (showsResult.error) {
        setMessage(showsResult.error.message);
        return;
      }
      if (eventsResult.error) {
        setMessage(eventsResult.error.message);
        return;
      }
      const showRows = showsResult.data ?? [];
      setShows(showRows);
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
        "event_id, entrant_id, entry_number, eliminated_at, eliminations_count"
      )
      .in("event_id", eventIds);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRumbleEntries((entryRows ?? []) as RumbleEntryRow[]);
  }, [selectedShowId, showEvents]);

  const loadMatches = useCallback(async () => {
    if (!selectedShowId) return;
    const { data: matchRows, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, name, kind, match_type, status, winner_entrant_id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id"
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
        nextRumbles[event.id] = {
          ...emptyRumblePick,
          ...(existingRumbles[event.id] ?? {}),
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
        });
        setHasSaved(true);
      } else {
        setPayload({
          rumbles: nextRumbles,
          match_picks: {},
          match_finish_picks: {},
        });
      }
    };

    loadShowData();
  }, [selectedShowId, userId, loadMatches, loadRumbleEntries, showEvents]);

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

      const nextRumbles: Record<string, RumblePick> = {};
      showEvents.forEach((event) => {
        const current = prev.rumbles[event.id] ?? emptyRumblePick;
        const selected = new Set(current.entrants);
        const finalFour = current.final_four.filter((id) => selected.has(id));
        const finalFourSet = new Set(finalFour);
        nextRumbles[event.id] = {
          ...current,
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
      };
    });
  }, [matches, showEvents]);

  useEffect(() => {
    if (editSection !== "key_picks") return;
    keyPicksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editSection]);

  const toggleEntrant = (eventId: string, id: string) => {
    setPayload((prev) => {
      const current = prev.rumbles[eventId] ?? emptyRumblePick;
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
    setMessage("Picks saved.");
    setSaving(false);
  };

  const getEntrant = (id: string | null) =>
    id ? entrantByIdAll.get(id) ?? null : null;

  const renderPickList = (
    ids: string[],
    correctSet: Set<string>,
    points: number,
    actualsHasData: boolean
  ) => {
    if (ids.length === 0) {
      return <p className="text-sm text-zinc-400">None selected.</p>;
    }
    return (
      <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1 text-sm text-zinc-200">
        {ids
          .map((id) => ({
            id,
            entrant: getEntrant(id),
            name: getEntrant(id)?.name ?? "Unknown",
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(({ id, entrant, name }) => {
            const isCorrect = actualsHasData && correctSet.has(id);
            const status = entrant?.status ?? "approved";
            const isPending =
              status === "pending" && entrant?.created_by === userId;
            const isApprovedCustom =
              status === "approved" &&
              entrant?.is_custom &&
              entrant?.created_by === userId;
            return (
              <li
                key={id}
                className={`rounded-xl border px-3 py-2 ${
                  !actualsHasData
                    ? "border-zinc-800"
                    : isCorrect
                      ? "border-emerald-400/60 bg-emerald-400/10"
                      : "border-red-500/50 bg-red-500/10"
                }`}
              >
                <EntrantCard
                  name={name}
                  promotion={entrant?.promotion}
                  imageUrl={entrant?.image_url}
                />
                {isPending && (
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                    Pending approval
                  </p>
                )}
                {isApprovedCustom && (
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                    Approved
                  </p>
                )}
                {actualsHasData && (
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

  const EditIcon = () => (
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );

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
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Make your predictions</h1>
          <p className="text-sm text-zinc-400">
            Choose a show and lock in your rumble picks before bell time.
          </p>
        </header>
        {!isLocked && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200">
            <p className="font-semibold text-amber-200">{lockInfo.label}</p>
            <p className="mt-1 text-xs text-zinc-400">{lockInfo.detail}</p>
          </div>
        )}
        {isLocked && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200">
            {rankInfo.rank ? (
              <span>
                Your current rank:{" "}
                <span className="font-semibold text-amber-200">
                  #{rankInfo.rank}
                </span>{" "}
                of {rankInfo.total}
              </span>
            ) : (
              <span className="text-zinc-400">
                Your rank will appear once scores are calculated for this show.
              </span>
            )}
          </div>
        )}
        {isLocked && (
          <div className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Picks are locked for this show.
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/50 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <label className="text-sm text-zinc-300">
            Show
            <select
              className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={selectedShowId}
              onChange={(event) => setSelectedShowId(event.target.value)}
            >
              {shows.length === 0 && <option value="">No shows yet</option>}
              {shows.map((show) => (
                <option key={show.id} value={show.id}>
                  {show.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        {showEvents.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <p className="text-sm text-zinc-400">
              No rumble events are available for this show yet.
            </p>
          </section>
        ) : !hasEntrantsForShow ? (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <p className="text-sm text-zinc-400">
              No entrants are available yet.
            </p>
          </section>
        ) : hasSaved && !editSection ? (
          <>
            {showEvents.map((event) => {
              const eventPick = getRumblePick(event.id);
              const eventActuals = actualsByEvent[event.id] ?? emptyActuals;
              const points = sectionPointsByEvent[event.id] ?? {
                entrants: null,
                finalFour: null,
                keyPicks: null,
              };
              return (
                <section key={event.id} className="mt-8">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                      {event.rumble_gender ? `${event.rumble_gender} rumble` : "Rumble"}
                    </p>
                    <h2 className="text-xl font-semibold">{event.name}</h2>
                  </div>
                  <div className="mt-6 grid gap-6 lg:grid-cols-3">
                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Entrants</h3>
                        <button
                          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100 disabled:cursor-not-allowed disabled:text-zinc-600"
                          type="button"
                          onClick={() => setEditSection("entrants")}
                          disabled={isLocked}
                        >
                          <EditIcon />
                          Edit
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-zinc-400">
                        {eventPick.entrants.length} selected
                      </p>
                      {points.entrants !== null && (
                        <p className="mt-1 text-xs text-emerald-200">
                          Points: {points.entrants}
                        </p>
                      )}
                      {renderPickList(
                        eventPick.entrants,
                        eventActuals.entrantSet,
                        scoringRules.entrants,
                        eventActuals.hasData
                      )}
                    </div>

                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Final Four</h3>
                        <button
                          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100 disabled:cursor-not-allowed disabled:text-zinc-600"
                          type="button"
                          onClick={() => setEditSection("final_four")}
                          disabled={isLocked}
                        >
                          <EditIcon />
                          Edit
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-zinc-400">
                        {eventPick.final_four.length} selected
                      </p>
                      {points.finalFour !== null && (
                        <p className="mt-1 text-xs text-emerald-200">
                          Points: {points.finalFour}
                        </p>
                      )}
                      {renderPickList(
                        eventPick.final_four,
                        eventActuals.finalFourSet,
                        scoringRules.final_four,
                        eventActuals.hasData
                      )}
                    </div>

                    <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Key Picks</h3>
                        <button
                          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100 disabled:cursor-not-allowed disabled:text-zinc-600"
                          type="button"
                          onClick={() => setEditSection("key_picks")}
                          disabled={isLocked}
                        >
                          <EditIcon />
                          Edit
                        </button>
                      </div>
                      {points.keyPicks !== null && (
                        <p className="mt-2 text-xs text-emerald-200">
                          Points: {points.keyPicks}
                        </p>
                      )}
                      <div className="mt-4 space-y-3 text-sm text-zinc-200">
                        {[
                          ["Winner", eventPick.winner, eventActuals.winner, scoringRules.winner],
                          ["Entry #1", eventPick.entry_1, eventActuals.entry1, scoringRules.entry_1],
                          ["Entry #2", eventPick.entry_2, eventActuals.entry2, scoringRules.entry_2],
                          ["Entry #30", eventPick.entry_30, eventActuals.entry30, scoringRules.entry_30],
                          [
                            "Most eliminations",
                            eventPick.most_eliminations,
                            null,
                            scoringRules.most_eliminations,
                          ],
                        ].map(([label, value, actual, points]) => {
                          const entrant = value ? getEntrant(String(value)) : null;
                          const isCorrect =
                            eventActuals.hasData &&
                            (label === "Most eliminations"
                              ? value && eventActuals.topElims.has(String(value))
                              : value && actual === value);
                          return (
                            <div
                              key={label as string}
                              className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                                !eventActuals.hasData
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
                              {eventActuals.hasData && (
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
                    </div>
                  </div>
                </section>
              );
            })}

            <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Match Picks</h2>
                <button
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100 disabled:cursor-not-allowed disabled:text-zinc-600"
                  type="button"
                  onClick={() => setEditSection("matches")}
                  disabled={isLocked}
                >
                  <EditIcon />
                  Edit
                </button>
              </div>
              {matchPoints !== null && (
                <p className="mt-2 text-xs text-emerald-200">
                  Points: {matchPoints}
                </p>
              )}
              {matches.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-400">
                  No matches available yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3 text-sm text-zinc-200">
                  {matches.map((match) => {
                    const pick = payload.match_picks[match.id] ?? null;
                    const winner = matchWinnerMap.get(match.id) ?? null;
                    const sides = matchSidesByMatch[match.id] ?? [];
                    const pickSide = pick
                      ? sides.find((side) => side.id === pick)
                      : null;
                    const pickLabel = pickSide?.label?.trim() || "Selected side";
                    const pickEntrants = pick
                      ? (matchEntrantsByMatch[match.id] ?? [])
                          .filter((row) => row.side_id === pick)
                          .map((row) => entrantByIdAll.get(row.entrant_id))
                          .filter(Boolean)
                      : [];
                    const entrantCount = (matchEntrantsByMatch[match.id] ?? []).length;
                    const finishPick = payload.match_finish_picks[match.id];
                    const finishMethod = finishPick?.method ?? null;
                    const finishWinner = finishPick?.winner
                      ? entrantByIdAll.get(finishPick.winner)
                      : null;
                    const finishLoser = finishPick?.loser
                      ? entrantByIdAll.get(finishPick.loser)
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
                    const isCorrect = winner && pick ? winner === pick : false;
                    return (
                      <div
                        key={match.id}
                        className={`rounded-xl border px-3 py-2 ${
                          !winner
                            ? "border-zinc-800"
                            : isCorrect
                              ? "border-emerald-400/60 bg-emerald-400/10"
                              : "border-red-500/50 bg-red-500/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                              {match.kind}
                            </p>
                            <p className="text-sm font-semibold text-zinc-100">
                              {match.name}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-right">
                            <span className="text-xs font-semibold text-zinc-200">
                              {pick ? pickLabel : "Not set"}
                            </span>
                            {pickEntrants.length > 0 && (
                              <span className="text-xs text-zinc-500">
                                {pickEntrants
                                  .map((entrant) => entrant?.name)
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            )}
                          </div>
                          {winner && (
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wide ${
                                isCorrect ? "text-emerald-200" : "text-red-200"
                              }`}
                            >
                              {isCorrect
                                ? `+${scoringRules.match_winner} pts`
                                : "0 pts"}
                            </span>
                          )}
                        </div>
                        {entrantCount > 2 && (
                          <div className="mt-3 space-y-2 text-xs text-zinc-400">
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
                              finishMethod === "submission") && (
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
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            {(editSection === "entrants" || !hasSaved) && (
              <>
                {showEvents.map((event) => {
                  const eventPick = getRumblePick(event.id);
                  const { grouped, count } = getFilteredEntrantsByPromotion(event.id);
                  return (
                    <section
                      key={event.id}
                      className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                            {event.rumble_gender ? `${event.rumble_gender} rumble` : "Rumble"}
                          </p>
                          <h2 className="text-lg font-semibold">{event.name}</h2>
                          <p className="mt-2 text-sm text-zinc-400">
                            Select up to 30. You have picked {eventPick.entrants.length}.
                          </p>
                        </div>
                        {hasSaved && (
                          <button
                            className="text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
                            type="button"
                            onClick={() => setEditSection(null)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-300">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p>Don’t see an entrant? Add a custom one for this event.</p>
                          <button
                            className="inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            onClick={() => {
                              setCustomModalEventId(event.id);
                              setCustomModalOpen(true);
                            }}
                            disabled={isLocked}
                          >
                            Add custom
                          </button>
                        </div>
                      </div>
                      <div className="mt-4">
                        <input
                          className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                          placeholder="Search entrants"
                          value={entrantSearch}
                          onChange={(event) => setEntrantSearch(event.target.value)}
                        />
                        <p className="mt-2 text-xs text-zinc-500">
                          {count} entrant{count === 1 ? "" : "s"}
                          {entrantSearch ? " match your search." : " available."}
                        </p>
                      </div>
                      <div className="mt-4 max-h-[520px] space-y-6 overflow-y-auto pr-1">
                        <div className="sticky top-0 z-10 -mx-1 rounded-2xl border border-zinc-800 bg-zinc-950/90 px-4 py-2 text-xs text-zinc-300 backdrop-blur">
                          <div className="flex items-center justify-between">
                            <span>
                              Selected:{" "}
                              <span className="font-semibold text-amber-200">
                                {eventPick.entrants.length}/30
                              </span>
                            </span>
                            <span className="text-zinc-500">
                              {Math.max(30 - eventPick.entrants.length, 0)} remaining
                            </span>
                          </div>
                        </div>
                        {count === 0 ? (
                          <p className="text-sm text-zinc-400">
                            No entrants match your search.
                          </p>
                        ) : (
                          Object.entries(grouped)
                            .sort(([a], [b]) => {
                              const order = ["WWE", "TNA", "AAA"];
                              const aIndex = order.indexOf(a);
                              const bIndex = order.indexOf(b);
                              if (aIndex !== -1 || bIndex !== -1) {
                                return (
                                  (aIndex === -1 ? order.length : aIndex) -
                                  (bIndex === -1 ? order.length : bIndex)
                                );
                              }
                              return a.localeCompare(b);
                            })
                            .map(([promotion, promotionEntrants]) => (
                              <div key={promotion}>
                                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                                  {promotion}
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                  {promotionEntrants.map((entrant) => (
                                    <label
                                      key={entrant.id}
                                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                                        eventPick.entrants.includes(entrant.id)
                                          ? "border-amber-400 bg-amber-400/10"
                                          : "border-zinc-800 bg-zinc-950/70"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={eventPick.entrants.includes(entrant.id)}
                                        onChange={() => toggleEntrant(event.id, entrant.id)}
                                        disabled={isLocked}
                                      />
                                      <EntrantCard
                                        name={entrant.name}
                                        promotion={entrant.promotion}
                                        imageUrl={entrant.image_url}
                                        className="flex-1"
                                      />
                                      {(entrant.status ?? "approved") === "pending" &&
                                        entrant.created_by === userId && (
                                          <span className="rounded-full border border-amber-400/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                                            Pending
                                          </span>
                                        )}
                                      {(entrant.status ?? "approved") === "approved" &&
                                        entrant.is_custom &&
                                        entrant.created_by === userId && (
                                          <span className="rounded-full border border-emerald-400/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                                            Approved
                                          </span>
                                        )}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                      {hasSaved && (
                        <div className="mt-6">
                          <button
                            className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                            type="button"
                            onClick={handleSave}
                            disabled={saving || isLocked}
                          >
                            {saving ? "Saving…" : "Save entrants"}
                          </button>
                        </div>
                      )}
                    </section>
                  );
                })}
              </>
            )}

            {(editSection === "final_four" || !hasSaved) && (
              <>
                {showEvents.map((event) => {
                  const eventPick = getRumblePick(event.id);
                  const selectedEntrants = getSelectedEntrantOptions(event.id);
                  return (
                    <section
                      key={event.id}
                      className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                            {event.rumble_gender ? `${event.rumble_gender} rumble` : "Rumble"}
                          </p>
                          <h2 className="text-lg font-semibold">Final Four</h2>
                          <p className="mt-2 text-sm text-zinc-400">
                            Select exactly 4. You have picked {eventPick.final_four.length}.
                          </p>
                        </div>
                        {hasSaved && (
                          <button
                            className="text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
                            type="button"
                            onClick={() => setEditSection(null)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {selectedEntrants.map((entrant) => (
                          <label
                            key={entrant.id}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                              eventPick.final_four.includes(entrant.id)
                                ? "border-amber-400 bg-amber-400/10"
                                : "border-zinc-800 bg-zinc-950/70"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={eventPick.final_four.includes(entrant.id)}
                              onChange={() => toggleFinalFour(event.id, entrant.id)}
                              disabled={isLocked}
                            />
                            <EntrantCard
                              name={entrant.name}
                              promotion={entrant.promotion}
                              imageUrl={entrant.image_url}
                              className="flex-1"
                            />
                          </label>
                        ))}
                      </div>
                      {hasSaved && (
                        <div className="mt-6">
                          <button
                            className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                            type="button"
                            onClick={handleSave}
                            disabled={saving || isLocked}
                          >
                            {saving ? "Saving…" : "Save final four"}
                          </button>
                        </div>
                      )}
                    </section>
                  );
                })}
              </>
            )}

            {(editSection === "matches" || !hasSaved) && (
              <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Match Picks</h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      Pick winners for the matches on the card.
                    </p>
                  </div>
                  {hasSaved && (
                    <button
                      className="text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
                      type="button"
                      onClick={() => setEditSection(null)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {matches.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-400">
                    No matches available yet.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {matches.map((match) => {
                      const sides = matchSidesByMatch[match.id] ?? [];
                      const participantRows = matchEntrantsByMatch[match.id] ?? [];
                      const sideEntries = sides.map((side, index) => {
                        const entrantsForSide = participantRows
                          .filter((row) => row.side_id === side.id)
                          .map((row) => entrantByIdAll.get(row.entrant_id))
                          .filter(Boolean) as EntrantRow[];
                        const label = side.label?.trim() || `Side ${index + 1}`;
                        return { side, label, entrants: entrantsForSide };
                      });
                      const allEntrants = participantRows
                        .map((row) => entrantByIdAll.get(row.entrant_id))
                        .filter(Boolean) as EntrantRow[];
                      const sortedEntrants = [...allEntrants].sort((a, b) =>
                        a.name.localeCompare(b.name)
                      );
                      const finishPick = payload.match_finish_picks[match.id] ?? {
                        method: null,
                        winner: null,
                        loser: null,
                      };
                      const finishRequiresEntrants =
                        finishPick.method === "pinfall" ||
                        finishPick.method === "submission";
                      return (
                        <div
                          key={match.id}
                          className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                                {match.kind}
                              </p>
                              <p className="text-sm font-semibold text-zinc-100">
                                {match.name}
                              </p>
                            </div>
                            <select
                              className="h-10 min-w-[220px] rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                              value={payload.match_picks[match.id] ?? ""}
                              onChange={(event) =>
                                setPayload((prev) => ({
                                  ...prev,
                                  match_picks: {
                                    ...prev.match_picks,
                                    [match.id]: event.target.value || null,
                                  },
                                }))
                              }
                              disabled={isLocked || sideEntries.length === 0}
                            >
                              <option value="">Select winner</option>
                              {sideEntries.map(({ side, label, entrants }) => (
                                <option key={side.id} value={side.id}>
                                  {label}
                                  {entrants.length > 0
                                    ? ` — ${entrants
                                        .map((entrant) => entrant.name)
                                        .join(", ")}`
                                    : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                          {sideEntries.length === 0 && (
                            <p className="mt-2 text-xs text-zinc-500">
                              Add match participants in admin to enable picks.
                            </p>
                          )}
                          {sideEntries.length > 0 && (
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              {sideEntries.map(({ side, label, entrants }) => (
                                <div
                                  key={side.id}
                                  className={`rounded-xl border px-3 py-2 ${
                                    payload.match_picks[match.id] === side.id
                                      ? "border-amber-400/60 bg-amber-400/10"
                                      : "border-zinc-800 bg-zinc-900/60"
                                  }`}
                                >
                                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                                    {label}
                                  </p>
                                  {entrants.length === 0 ? (
                                    <p className="mt-2 text-xs text-zinc-500">
                                      No participants.
                                    </p>
                                  ) : (
                                    <div className="mt-2 space-y-2">
                                      {entrants.map((entrant) => (
                                        <EntrantCard
                                          key={entrant.id}
                                          name={entrant.name}
                                          promotion={entrant.promotion}
                                          imageUrl={entrant.image_url}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {allEntrants.length > 2 && (
                            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                                Finish prediction
                              </p>
                              <div className="mt-3 grid gap-3 md:grid-cols-3">
                                <select
                                  className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                                  value={finishPick.method ?? ""}
                                  onChange={(event) => {
                                    const method = event.target.value || null;
                                    setPayload((prev) => ({
                                      ...prev,
                                      match_finish_picks: {
                                        ...prev.match_finish_picks,
                                        [match.id]: {
                                          method,
                                          winner:
                                            method === "pinfall" || method === "submission"
                                              ? finishPick.winner
                                              : null,
                                          loser:
                                            method === "pinfall" || method === "submission"
                                              ? finishPick.loser
                                              : null,
                                        },
                                      },
                                    }));
                                  }}
                                  disabled={isLocked}
                                >
                                  <option value="">Select finish</option>
                                  <option value="pinfall">Pinfall</option>
                                  <option value="submission">Submission</option>
                                  <option value="disqualification">Disqualification</option>
                                </select>
                                <select
                                  className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                                  value={finishPick.winner ?? ""}
                                  onChange={(event) =>
                                    setPayload((prev) => ({
                                      ...prev,
                                      match_finish_picks: {
                                        ...prev.match_finish_picks,
                                        [match.id]: {
                                          ...finishPick,
                                          winner: event.target.value || null,
                                        },
                                      },
                                    }))
                                  }
                                  disabled={isLocked || !finishRequiresEntrants}
                                >
                                  <option value="">Winner (pin/sub)</option>
                                  {sortedEntrants.map((entrant) => (
                                    <option key={entrant.id} value={entrant.id}>
                                      {entrant.name}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                                  value={finishPick.loser ?? ""}
                                  onChange={(event) =>
                                    setPayload((prev) => ({
                                      ...prev,
                                      match_finish_picks: {
                                        ...prev.match_finish_picks,
                                        [match.id]: {
                                          ...finishPick,
                                          loser: event.target.value || null,
                                        },
                                      },
                                    }))
                                  }
                                  disabled={isLocked || !finishRequiresEntrants}
                                >
                                  <option value="">Loser (pin/sub)</option>
                                  {sortedEntrants.map((entrant) => (
                                    <option key={entrant.id} value={entrant.id}>
                                      {entrant.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <p className="mt-2 text-xs text-zinc-500">
                                Only required for matches with more than two entrants.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {hasSaved && (
                  <div className="mt-6">
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                      type="button"
                      onClick={handleSave}
                      disabled={saving || isLocked}
                    >
                      {saving ? "Saving…" : "Save match picks"}
                    </button>
                  </div>
                )}
              </section>
            )}

            {(editSection === "key_picks" || !hasSaved) && (
              <>
                {showEvents.map((event) => {
                  const eventPick = getRumblePick(event.id);
                  const selectedEntrants = getSelectedEntrantOptions(event.id);
                  const selectedFinalFour = getSelectedFinalFourOptions(event.id);
                  return (
                    <section
                      key={event.id}
                      ref={event.id === showEvents[0]?.id ? keyPicksRef : null}
                      className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                            {event.rumble_gender ? `${event.rumble_gender} rumble` : "Rumble"}
                          </p>
                          <h2 className="text-lg font-semibold">Key Picks</h2>
                          <p className="mt-2 text-sm text-zinc-400">
                            Choose your winner and entry position picks.
                          </p>
                        </div>
                        {hasSaved && (
                          <button
                            className="text-xs font-semibold uppercase tracking-wide text-zinc-400 hover:text-zinc-200"
                            type="button"
                            onClick={() => setEditSection(null)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <div className="mt-4 space-y-4">
                        {(
                          [
                            { label: "Winner", key: "winner" },
                            { label: "Entry #1", key: "entry_1" },
                            { label: "Entry #2", key: "entry_2" },
                            { label: "Entry #30", key: "entry_30" },
                            { label: "Most eliminations", key: "most_eliminations" },
                          ] as const
                        ).map((field) => (
                          <label
                            key={field.key}
                            className="flex flex-col text-sm text-zinc-300"
                          >
                            {field.label}
                            <select
                              className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                              value={eventPick[field.key] ?? ""}
                              onChange={(eventChange) =>
                                setPayload((prev) => {
                                  const current =
                                    prev.rumbles[event.id] ?? emptyRumblePick;
                                  return {
                                    ...prev,
                                    rumbles: {
                                      ...prev.rumbles,
                                      [event.id]: {
                                        ...current,
                                        [field.key]: eventChange.target.value || null,
                                      },
                                    },
                                  };
                                })
                              }
                              disabled={isLocked}
                            >
                              <option value="">Select</option>
                              {(field.key === "winner"
                                ? selectedFinalFour
                                : selectedEntrants
                              ).map((entrant) => (
                                <option key={entrant.id} value={entrant.id}>
                                  {entrant.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                      {hasSaved && (
                        <div className="mt-6">
                          <button
                            className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                            type="button"
                            onClick={handleSave}
                            disabled={saving || isLocked}
                          >
                            {saving ? "Saving…" : "Save key picks"}
                          </button>
                        </div>
                      )}
                    </section>
                  );
                })}
              </>
            )}

            {!hasSaved && (
              <section className="mt-8 flex flex-col items-start gap-3">
                <button
                  className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                  type="button"
                  onClick={handleSave}
                  disabled={saving || isLocked}
                >
                  {saving ? "Saving…" : "Save picks"}
                </button>
                <p className="text-xs text-zinc-500">
                  Your picks can be updated until the show locks.
                </p>
              </section>
            )}
          </>
        )}
        {customModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
            <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Add custom entrant</h3>
                <button
                  className="text-sm text-zinc-400 transition hover:text-zinc-200"
                  type="button"
                  onClick={() => {
                    setCustomModalOpen(false);
                    setCustomModalEventId(null);
                  }}
                >
                  Close
                </button>
              </div>
              {customModalEvent && (
                <p className="mt-1 text-xs text-zinc-500">
                  For {customModalEvent.name}
                </p>
              )}
              <p className="mt-2 text-sm text-zinc-400">
                Custom entrants require admin approval before they show up for
                everyone.
              </p>
              <input
                className="mt-4 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-base text-zinc-100"
                placeholder="Entrant name"
                value={customEntrantName}
                onChange={(event) => setCustomEntrantName(event.target.value)}
                autoFocus
              />
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
                  type="button"
                  onClick={() => {
                    setCustomModalOpen(false);
                    setCustomModalEventId(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center rounded-full bg-amber-400 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                  type="button"
                  onClick={handleAddCustomEntrant}
                  disabled={isLocked}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
