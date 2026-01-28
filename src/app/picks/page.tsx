"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [rankInfo, setRankInfo] = useState<RankInfo>({ rank: null, total: 0 });
  const [customEntrantName, setCustomEntrantName] = useState("");
  const [entrantSearch, setEntrantSearch] = useState("");
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customModalEventId, setCustomModalEventId] = useState<string | null>(null);
  const keyPicksRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [editSection, setEditSection] = useState<EditSection>(null);

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
          subtitle="Choose a show and lock in your rumble picks before bell time."
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
          onChange={setSelectedShowId}
        />

        {!hasEvents && (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <p className="text-sm text-zinc-400">
              No rumble events are available for this show yet.
            </p>
          </section>
        )}
        {hasEvents && !hasEntrantsForShow && (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <p className="text-sm text-zinc-400">
              No entrants are available yet.
            </p>
          </section>
        )}

        {hasSaved && !editSection ? (
          <>
            {canShowRumbles &&
              showEvents.map((event) => {
                const eventPick = getRumblePick(event.id);
                const eventActuals = actualsByEvent[event.id] ?? emptyActuals;
                const points =
                  sectionPointsByEvent[event.id] ??
                  ({ entrants: null, finalFour: null, keyPicks: null } as SectionPoints);
                return (
                  <RumbleSummarySection
                    key={event.id}
                    event={event}
                    eventPick={eventPick}
                    actuals={eventActuals}
                    points={points}
                    entrantByIdAll={entrantByIdAll}
                    userId={userId}
                    isLocked={isLocked}
                    onEdit={setEditSection}
                  />
                );
              })}

            <MatchSummarySection
              matches={matches}
              matchPoints={matchPoints}
              matchWinnerMap={matchWinnerMap}
              matchSidesByMatch={matchSidesByMatch}
              matchEntrantsByMatch={matchEntrantsByMatch}
              entrantByIdAll={entrantByIdAll}
              payload={payload}
              isLocked={isLocked}
              onEdit={setEditSection}
            />
          </>
        ) : (
          <>
            {canShowRumbles && (editSection === "entrants" || !hasSaved) && (
              <>
                {showEvents.map((event) => {
                  const eventPick = getRumblePick(event.id);
                  const { grouped, count } = getFilteredEntrantsByPromotion(event.id);
                  return (
                    <RumbleEntrantsEditor
                      key={event.id}
                      event={event}
                      eventPick={eventPick}
                      grouped={grouped}
                      count={count}
                      entrantSearch={entrantSearch}
                      setEntrantSearch={setEntrantSearch}
                      toggleEntrant={toggleEntrant}
                      hasSaved={hasSaved}
                      isLocked={isLocked}
                      onCancel={() => setEditSection(null)}
                      onSave={handleSave}
                      saving={saving}
                      userId={userId}
                      onOpenCustomModal={() => {
                        setCustomModalEventId(event.id);
                        setCustomModalOpen(true);
                      }}
                    />
                  );
                })}
              </>
            )}

            {canShowRumbles && (editSection === "final_four" || !hasSaved) && (
              <>
                {showEvents.map((event) => {
                  const eventPick = getRumblePick(event.id);
                  const selectedEntrants = getSelectedEntrantOptions(event.id);
                  return (
                    <RumbleFinalFourEditor
                      key={event.id}
                      event={event}
                      eventPick={eventPick}
                      selectedEntrants={selectedEntrants}
                      toggleFinalFour={toggleFinalFour}
                      hasSaved={hasSaved}
                      isLocked={isLocked}
                      onCancel={() => setEditSection(null)}
                      onSave={handleSave}
                      saving={saving}
                    />
                  );
                })}
              </>
            )}

            {(editSection === "matches" || !hasSaved) && (
              <MatchPicksSection
                matches={matches}
                matchSidesByMatch={matchSidesByMatch}
                matchEntrantsByMatch={matchEntrantsByMatch}
                entrantByIdAll={entrantByIdAll}
                payload={payload}
                setPayload={setPayload}
                isLocked={isLocked}
                hasSaved={hasSaved}
                onCancel={() => setEditSection(null)}
                onSave={handleSave}
                saving={saving}
              />
            )}

            {canShowRumbles && (editSection === "key_picks" || !hasSaved) && (
              <>
                {showEvents.map((event) => {
                  const eventPick = getRumblePick(event.id);
                  const selectedEntrants = getSelectedEntrantOptions(event.id);
                  const selectedFinalFour = getSelectedFinalFourOptions(event.id);
                  return (
                    <KeyPicksEditor
                      key={event.id}
                      event={event}
                      eventPick={eventPick}
                      selectedEntrants={selectedEntrants}
                      selectedFinalFour={selectedFinalFour}
                      isLocked={isLocked}
                      hasSaved={hasSaved}
                      onCancel={() => setEditSection(null)}
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
                      sectionRef={event.id === showEvents[0]?.id ? keyPicksRef : undefined}
                    />
                  );
                })}
              </>
            )}

            {!hasSaved && (
              <SavePicksFooter
                saving={saving}
                isLocked={isLocked}
                onSave={handleSave}
              />
            )}
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
    </div>
  );
}
