"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { EntrantCard } from "../../components/EntrantCard";
import { calculateScore, type PicksPayload } from "../../lib/scoring";
import { scoringRules } from "../../lib/scoringRules";

type EventRow = {
  id: string;
  name: string;
  status: string;
  starts_at: string | null;
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
  active: boolean;
  image_url: string | null;
  roster_year: number | null;
  event_id: string | null;
  is_custom: boolean;
  created_by: string | null;
  status: string | null;
};

type RumbleEntryRow = {
  id: string;
  entrant_id: string;
  entry_number: number | null;
  eliminated_by: string | null;
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

type MatchSideRow = {
  id: string;
  match_id: string;
  label: string | null;
};

type MatchEntrantRow = {
  id: string;
  match_id: string;
  entrant_id: string;
  side_id: string | null;
};

type PickRow = {
  id: string;
  user_id: string;
  payload: Record<string, unknown> | null;
};

export default function AdminPage() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [entrants, setEntrants] = useState<EntrantRow[]>([]);
  const [entries, setEntries] = useState<RumbleEntryRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchSides, setMatchSides] = useState<MatchSideRow[]>([]);
  const [matchEntrants, setMatchEntrants] = useState<MatchEntrantRow[]>([]);

  const [eventName, setEventName] = useState("");
  const [eventGender, setEventGender] = useState("men");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventRosterYear, setEventRosterYear] = useState("");
  const [eventShowId, setEventShowId] = useState("");
  const [showName, setShowName] = useState("");
  const [showStartsAt, setShowStartsAt] = useState("");
  const [eventUpdateBusy, setEventUpdateBusy] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [entryEntrantId, setEntryEntrantId] = useState("");
  const [entryNumber, setEntryNumber] = useState("");
  const [eliminateEntryId, setEliminateEntryId] = useState("");
  const [eliminatedById, setEliminatedById] = useState("");
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [customEntrantName, setCustomEntrantName] = useState("");
  const [matchName, setMatchName] = useState("");
  const [matchKind, setMatchKind] = useState("match");
  const [matchType, setMatchType] = useState("singles");
  const [matchEntrantSelection, setMatchEntrantSelection] = useState<Record<string, string>>({});
  const [matchSideSelection, setMatchSideSelection] = useState<Record<string, string>>({});
  const [matchNameEdits, setMatchNameEdits] = useState<Record<string, string>>({});
  const [matchSideLabelEdits, setMatchSideLabelEdits] = useState<Record<string, string>>({});
  const [matchFinishEdits, setMatchFinishEdits] = useState<
    Record<string, { method: string; winner: string; loser: string }>
  >({});

  const formatLocalDateTime = (value: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const activeEvent = useMemo(() => {
    if (selectedEventId) {
      return events.find((event) => event.id === selectedEventId) ?? null;
    }
    return events[0] ?? null;
  }, [events, selectedEventId]);
  useEffect(() => {
    setEventStartsAt(formatLocalDateTime(activeEvent?.starts_at ?? null));
    setEventRosterYear(
      activeEvent?.roster_year ? String(activeEvent.roster_year) : ""
    );
    setEventShowId(activeEvent?.show_id ?? "");
  }, [activeEvent?.starts_at, activeEvent?.roster_year]);
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
  const entrantOptions = useMemo(() => {
    return [...entrants].sort((a, b) => a.name.localeCompare(b.name));
  }, [entrants]);
  const filteredEntrantOptions = useMemo(() => {
    const gender = activeEvent?.rumble_gender;
    const rosterYear = activeEvent?.roster_year;
    const eventId = activeEvent?.id ?? null;
    const base = entrantOptions.filter((entrant) => {
      const matchesGender = !gender || entrant.gender === gender;
      const matchesYear = !rosterYear || entrant.roster_year === rosterYear;
      const matchesEvent = eventId ? entrant.event_id === eventId : false;
      const isRosterEntrant = entrant.event_id === null;
      const isApproved = (entrant.status ?? "approved") === "approved";
      return (
        isApproved && matchesGender && (matchesEvent || (isRosterEntrant && matchesYear))
      );
    });
    const byName = new Map<string, EntrantRow>();
    base.forEach((entrant) => {
      const nameKey = entrant.name.trim().toLowerCase();
      const current = byName.get(nameKey);
      if (!current) {
        byName.set(nameKey, entrant);
        return;
      }
      const currentMatchesEvent = eventId && current.event_id === eventId;
      const nextMatchesEvent = eventId && entrant.event_id === eventId;
      if (!currentMatchesEvent && nextMatchesEvent) {
        byName.set(nameKey, entrant);
        return;
      }
      const currentIsWwe = (current.promotion ?? "").toLowerCase() === "wwe";
      const nextIsWwe = (entrant.promotion ?? "").toLowerCase() === "wwe";
      if (!currentIsWwe && nextIsWwe) {
        byName.set(nameKey, entrant);
      }
    });
    return Array.from(byName.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [activeEvent?.rumble_gender, activeEvent?.roster_year, activeEvent?.id, entrantOptions]);
  const eventEntrantOptions = useMemo(() => {
    const eventEntrantIds = new Set(entries.map((entry) => entry.entrant_id));
    return filteredEntrantOptions.filter((entrant) =>
      eventEntrantIds.has(entrant.id)
    );
  }, [entries, filteredEntrantOptions]);
  const eventEntrantIdSet = useMemo(() => {
    return new Set(entries.map((entry) => entry.entrant_id));
  }, [entries]);
  const entrantsByPromotion = useMemo(() => {
    return filteredEntrantOptions.reduce((groups, entrant) => {
      const key = entrant.promotion ?? "Other";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(entrant);
      return groups;
    }, {} as Record<string, EntrantRow[]>);
  }, [filteredEntrantOptions]);

  const pendingEntrants = useMemo(() => {
    if (!activeEvent?.id) return [];
    return entrants
      .filter(
        (entrant) =>
          entrant.event_id === activeEvent.id &&
          (entrant.status ?? "approved") === "pending"
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeEvent?.id, entrants]);

  const refreshData = async () => {
    if (!activeEvent) {
      const [{ data: showRows }, { data: eventRows }] = await Promise.all([
        supabase
          .from("shows")
          .select("id, name, status, starts_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("events")
          .select("id, name, status, starts_at, rumble_gender, roster_year, show_id")
          .order("created_at", { ascending: false }),
      ]);
      setShows(showRows ?? []);
      setEvents(eventRows ?? []);
      if (!selectedEventId && eventRows && eventRows.length > 0) {
        setSelectedEventId(eventRows[0].id);
      }
    } else {
        const [
          { data: showRows },
          { data: eventRows },
          { data: entrantRows },
          { data: entryRows },
          { data: matchRows },
          { data: matchSideRows },
          { data: matchEntrantRows },
        ] = await Promise.all([
          supabase
            .from("shows")
            .select("id, name, status, starts_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("events")
            .select("id, name, status, starts_at, rumble_gender, roster_year, show_id")
            .order("created_at", { ascending: false }),
          supabase
            .from("entrants")
            .select(
              "id, name, promotion, gender, active, image_url, roster_year, event_id, is_custom, created_by, status"
            )
            .order("name", { ascending: true }),
          supabase
            .from("rumble_entries")
            .select(
              "id, entrant_id, entry_number, eliminated_by, eliminated_at, eliminations_count"
            )
            .eq("event_id", activeEvent.id)
            .order("entry_number", { ascending: true }),
          supabase
            .from("matches")
            .select(
              "id, name, kind, match_type, status, winner_entrant_id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id"
            )
            .eq("event_id", activeEvent.id)
            .order("created_at", { ascending: true }),
          supabase
            .from("match_sides")
            .select("id, match_id, label"),
          supabase
            .from("match_entrants")
            .select("id, match_id, entrant_id, side_id"),
        ]);
      setShows(showRows ?? []);
      setEvents(eventRows ?? []);
      if (!selectedEventId && eventRows && eventRows.length > 0) {
        setSelectedEventId(eventRows[0].id);
      }
      setEntrants(entrantRows ?? []);
      setEntries(entryRows ?? []);
      const matchList = (matchRows ?? []) as MatchRow[];
      const matchIdSet = new Set(matchList.map((match) => match.id));
      const matchSideList = (matchSideRows ?? []).filter((row) =>
        matchIdSet.has(row.match_id)
      ) as MatchSideRow[];
      const matchEntrantList = (matchEntrantRows ?? []).filter((row) =>
        matchIdSet.has(row.match_id)
      ) as MatchEntrantRow[];
      setMatches(matchList);
      setMatchSides(matchSideList);
      setMatchEntrants(matchEntrantList);
      setMatchNameEdits((prev) => {
        const next = { ...prev };
        matchList.forEach((match) => {
          if (!next[match.id]) {
            next[match.id] = match.name;
          }
        });
        return next;
      });
      setMatchSideLabelEdits((prev) => {
        const next = { ...prev };
        matchSideList.forEach((side) => {
          if (!next[side.id]) {
            next[side.id] = side.label ?? "";
          }
        });
        return next;
      });
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (ignore) return;
      const session = data.session;
      setSessionEmail(session?.user.email ?? null);

      if (!session?.user.id) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single();
      setIsAdmin(Boolean(profile?.is_admin));
      setLoading(false);
    };

    loadSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isAdmin) {
      refreshData();
    }
  }, [isAdmin, activeEvent?.id, selectedEventId]);

  const handleCreateEvent = async () => {
    setMessage(null);
    if (!eventName.trim()) {
      setMessage("Event name is required.");
      return;
    }
    const { error } = await supabase
      .from("events")
      .insert({
        name: eventName.trim(),
        status: "draft",
        rumble_gender: eventGender,
        roster_year: eventRosterYear ? Number(eventRosterYear) : null,
        starts_at: eventStartsAt ? new Date(eventStartsAt).toISOString() : null,
        show_id: eventShowId || null,
      });
    if (error) {
      setMessage(error.message);
      return;
    }
    setEventName("");
    setEventStartsAt("");
    setEventGender("men");
    setEventRosterYear("");
    setEventShowId("");
    refreshData();
  };

  const handleCreateShow = async () => {
    setMessage(null);
    if (!showName.trim()) {
      setMessage("Show name is required.");
      return;
    }
    const { error } = await supabase.from("shows").insert({
      name: showName.trim(),
      status: "draft",
      starts_at: showStartsAt ? new Date(showStartsAt).toISOString() : null,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setShowName("");
    setShowStartsAt("");
    refreshData();
  };

  const handleAddCustomEntrant = async () => {
    if (!activeEvent) {
      setMessage("Select an event before adding a custom entrant.");
      return;
    }
    const trimmed = customEntrantName.trim();
    if (!trimmed) {
      setMessage("Custom entrant name is required.");
      return;
    }
    const normalized = trimmed.toLowerCase();
    const existing = filteredEntrantOptions.find(
      (entrant) => entrant.name.trim().toLowerCase() === normalized
    );
    if (existing) {
      setMessage("That entrant already exists on the roster.");
      return;
    }
    const mismatched = entrants.find(
      (entrant) => entrant.name.trim().toLowerCase() === normalized
    );
    if (mismatched) {
      setMessage(
        "That entrant exists on a different roster year. Adding as a custom entrant for this event."
      );
    }
    const { error } = await supabase.from("entrants").insert({
      name: trimmed,
      promotion: "Custom",
      gender: activeEvent.rumble_gender,
      roster_year: activeEvent.roster_year,
      event_id: activeEvent.id,
      is_custom: true,
      status: "approved",
      active: true,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setCustomEntrantName("");
    setMessage("Custom entrant added.");
    refreshData();
  };

  const handleApproveCustomEntrant = async (entrantId: string) => {
    const { error } = await supabase
      .from("entrants")
      .update({ status: "approved" })
      .eq("id", entrantId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Custom entrant approved.");
    refreshData();
  };

  const handleRejectCustomEntrant = async (entrantId: string) => {
    const { error } = await supabase.from("entrants").delete().eq("id", entrantId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Custom entrant rejected.");
    refreshData();
  };

  const handleUpdateEvent = async () => {
    if (!activeEvent) {
      setMessage("Select an event to update.");
      return;
    }
    setEventUpdateBusy(true);
    setMessage(null);
    const { error } = await supabase
      .from("events")
      .update({
        starts_at: eventStartsAt ? new Date(eventStartsAt).toISOString() : null,
        roster_year: eventRosterYear ? Number(eventRosterYear) : null,
        show_id: eventShowId || null,
      })
      .eq("id", activeEvent.id);
    if (error) {
      setMessage(error.message);
      setEventUpdateBusy(false);
      return;
    }
    setMessage("Event updated.");
    setEventUpdateBusy(false);
    refreshData();
  };

  const handleUpdateEntry = async (entry: RumbleEntryRow) => {
    setMessage(null);
    const { error } = await supabase
      .from("rumble_entries")
      .update({
        entry_number: entry.entry_number,
        eliminations_count: entry.eliminations_count,
        eliminated_by: entry.eliminated_by || null,
      })
      .eq("id", entry.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    await handleRecalculateScores({ silent: true });
    setMessage("Entry updated.");
    refreshData();
  };

  const handleAddEntry = async () => {
    setMessage(null);
    if (!activeEvent) {
      setMessage("Create an event first.");
      return;
    }
    if (!entryEntrantId) {
      setMessage("Select an entrant.");
      return;
    }
    const numberValue = entryNumber ? Number(entryNumber) : null;
    if (entryNumber && Number.isNaN(numberValue)) {
      setMessage("Entry number must be a number.");
      return;
    }
    const { error } = await supabase.from("rumble_entries").insert({
      event_id: activeEvent.id,
      entrant_id: entryEntrantId,
      entry_number: numberValue,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setEntryEntrantId("");
    setEntryNumber("");
    refreshData();
  };

  const handleAddMatch = async () => {
    setMessage(null);
    if (!activeEvent) {
      setMessage("Create an event first.");
      return;
    }
    if (!matchName.trim()) {
      setMessage("Enter a match name.");
      return;
    }
    const { data: newMatch, error } = await supabase
      .from("matches")
      .insert({
        event_id: activeEvent.id,
        show_id: activeEvent.show_id ?? null,
        name: matchName.trim(),
        kind: matchKind.trim() || "match",
        match_type: matchType,
      })
      .select("id")
      .single();
    if (error || !newMatch) {
      setMessage(error?.message ?? "Failed to create match.");
      return;
    }

    const sideCounts: Record<string, number> = {
      singles: 2,
      tag: 2,
      triple_threat: 3,
      fatal_4_way: 4,
      multi: 2,
    };
    const count = sideCounts[matchType] ?? 2;
    const labels = ["Side A", "Side B", "Side C", "Side D", "Side E", "Side F"];
    const sideRows = Array.from({ length: count }).map((_, index) => ({
      match_id: newMatch.id,
      label: labels[index] ?? `Side ${index + 1}`,
    }));
    const { error: sideError } = await supabase
      .from("match_sides")
      .insert(sideRows);
    if (sideError) {
      setMessage(sideError.message);
      return;
    }
    setMatchName("");
    setMatchKind("match");
    setMatchType("singles");
    refreshData();
  };

  const handleAddMatchEntrant = async (
    matchId: string,
    entrantId: string,
    sideId: string
  ) => {
    if (!matchId || !entrantId || !sideId) return;
    setMessage(null);
    const { error } = await supabase.from("match_entrants").insert({
      match_id: matchId,
      entrant_id: entrantId,
      side_id: sideId,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    refreshData();
  };

  const handleSetMatchWinner = async (matchId: string, winnerSideId: string) => {
    setMessage(null);
    const sideEntrants = matchEntrants.filter(
      (row) => row.match_id === matchId && row.side_id === winnerSideId
    );
    const winnerEntrantId =
      sideEntrants.length === 1 ? sideEntrants[0].entrant_id : null;
    const { error } = await supabase
      .from("matches")
      .update({
        winner_side_id: winnerSideId || null,
        winner_entrant_id: winnerSideId ? winnerEntrantId : null,
        status: winnerSideId ? "completed" : "scheduled",
      })
      .eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await handleRecalculateScores({ silent: true });
    refreshData();
  };

  const handleAddMatchSide = async (matchId: string) => {
    if (!matchId) return;
    setMessage(null);
    const { error } = await supabase.from("match_sides").insert({
      match_id: matchId,
      label: "New side",
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    refreshData();
  };

  const handleUpdateMatchSideLabel = async (sideId: string, label: string) => {
    setMessage(null);
    const { error } = await supabase
      .from("match_sides")
      .update({ label: label.trim() || null })
      .eq("id", sideId);
    if (error) {
      setMessage(error.message);
      return;
    }
    refreshData();
  };

  const handleUpdateMatchName = async (matchId: string, name: string) => {
    setMessage(null);
    if (!name.trim()) {
      setMessage("Match name cannot be empty.");
      return;
    }
    const { error } = await supabase
      .from("matches")
      .update({ name: name.trim() })
      .eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Match updated.");
    refreshData();
  };

  const handleSetMatchFinish = async (
    matchId: string,
    method: string,
    winnerId: string,
    loserId: string
  ) => {
    setMessage(null);
    const normalized = method || "";
    const usesEntrants = normalized === "pinfall" || normalized === "submission";
    const updates = {
      finish_method: normalized || null,
      finish_winner_entrant_id: usesEntrants ? winnerId || null : null,
      finish_loser_entrant_id: usesEntrants ? loserId || null : null,
    };
    const { error } = await supabase
      .from("matches")
      .update(updates)
      .eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    await handleRecalculateScores({ silent: true });
    setMessage("Match finish updated.");
    refreshData();
  };

  const handleDeleteMatch = async (matchId: string) => {
    setMessage(null);
    const { error } = await supabase.from("matches").delete().eq("id", matchId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Match deleted.");
    refreshData();
  };

  useEffect(() => {
    if (!entryEntrantId) {
      if (entryNumber) {
        setEntryNumber("");
      }
      return;
    }
    if (!entryNumber) {
      setEntryNumber(String(entries.length + 1));
    }
  }, [entryEntrantId, entryNumber, entries.length]);

  const handleElimination = async () => {
    setMessage(null);
    if (!eliminateEntryId) {
      setMessage("Choose a rumble entry to eliminate.");
      return;
    }
    const { error } = await supabase
      .from("rumble_entries")
      .update({
        eliminated_by: eliminatedById || null,
        eliminated_at: new Date().toISOString(),
      })
      .eq("id", eliminateEntryId);
    if (error) {
      setMessage(error.message);
      return;
    }

    if (eliminatedById) {
      const { data: eliminatorEntry, error: eliminatorError } = await supabase
        .from("rumble_entries")
        .select("id, eliminations_count")
        .eq("event_id", activeEvent?.id ?? "")
        .eq("entrant_id", eliminatedById)
        .maybeSingle();
      if (!eliminatorError && eliminatorEntry) {
        await supabase
          .from("rumble_entries")
          .update({
            eliminations_count: (eliminatorEntry.eliminations_count ?? 0) + 1,
          })
          .eq("id", eliminatorEntry.id);
      }
    }

    await handleRecalculateScores({ silent: true });
    setEliminateEntryId("");
    setEliminatedById("");
    refreshData();
  };

  const handleRecalculateScores = async (
    options?: { silent?: boolean }
  ) => {
    if (!activeEvent) {
      setMessage("Create an event before recalculating scores.");
      return;
    }
    setRecalcBusy(true);
    if (!options?.silent) {
      setMessage(null);
    }

    const [
      { data: pickRows, error: pickError },
      { data: entryRows, error: entryError },
      { data: matchRows, error: matchError },
      { data: matchSideRows, error: matchSideError },
      { data: matchEntrantRows, error: matchEntrantError },
    ] = await Promise.all([
      supabase
        .from("picks")
        .select("id, user_id, payload")
        .eq("event_id", activeEvent.id),
      supabase
        .from("rumble_entries")
        .select("id, entrant_id, entry_number, eliminated_at, eliminations_count")
        .eq("event_id", activeEvent.id),
      supabase
        .from("matches")
        .select(
          "id, winner_entrant_id, winner_side_id, finish_method, finish_winner_entrant_id, finish_loser_entrant_id"
        )
        .eq("event_id", activeEvent.id),
      supabase
        .from("match_sides")
        .select("id, match_id, label"),
      supabase
        .from("match_entrants")
        .select("match_id, entrant_id, side_id"),
    ]);

    if (pickError) {
      setMessage(pickError.message);
      setRecalcBusy(false);
      return;
    }
    if (entryError) {
      setMessage(entryError.message);
      setRecalcBusy(false);
      return;
    }
    if (matchError) {
      setMessage(matchError.message);
      setRecalcBusy(false);
      return;
    }
    if (matchSideError) {
      setMessage(matchSideError.message);
      setRecalcBusy(false);
      return;
    }
    if (matchEntrantError) {
      setMessage(matchEntrantError.message);
      setRecalcBusy(false);
      return;
    }

    const picks = (pickRows ?? []) as PickRow[];
    const entries = (entryRows ?? []) as RumbleEntryRow[];

    if (picks.length === 0) {
      setMessage("No picks found for this event yet.");
      setRecalcBusy(false);
      return;
    }

    const matchList = (matchRows ?? []) as {
      id: string;
      winner_entrant_id: string | null;
      winner_side_id: string | null;
    }[];
    const matchIdSet = new Set(matchList.map((match) => match.id));
    const matchEntrantList = (matchEntrantRows ?? [])
      .filter((row) => matchIdSet.has(row.match_id)) as {
      match_id: string;
      entrant_id: string;
      side_id: string | null;
    }[];
    const matchSideList = (matchSideRows ?? [])
      .filter((row) => matchIdSet.has(row.match_id)) as {
      id: string;
      match_id: string;
      label: string | null;
    }[];
    const scoreRows = picks.map((pick) => {
      const payload = (pick.payload ?? {}) as PicksPayload;
      const { points, breakdown } = calculateScore(
        payload,
        entries,
        scoringRules,
        matchList,
        matchEntrantList,
        matchSideList
      );
      return {
        user_id: pick.user_id,
        event_id: activeEvent.id,
        points,
        breakdown,
        updated_at: new Date().toISOString(),
      };
    });

    const { error: scoreError } = await supabase
      .from("scores")
      .upsert(scoreRows, { onConflict: "user_id,event_id" });

    if (scoreError) {
      setMessage(scoreError.message);
      setRecalcBusy(false);
      return;
    }

    if (!options?.silent) {
      setMessage("Scores recalculated.");
    }
    setRecalcBusy(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
          <p>Loading admin console…</p>
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
            Visit the login screen to access the admin console.
          </p>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-200">
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-semibold">Admin access only</h1>
          <p className="mt-4 text-sm text-zinc-400">
            Your account does not have admin privileges.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Admin Console
          </p>
          <h1 className="text-3xl font-semibold">Rumble Operations</h1>
          <p className="text-sm text-zinc-400">
            Create events, manage entrants, and track eliminations live.
          </p>
        </header>

        {message && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/50 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        )}

        <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Active event</h2>
              <p className="mt-2 text-sm text-zinc-400">
                {activeEvent
                  ? `${activeEvent.name} (${activeEvent.rumble_gender ?? "unspecified"}${activeEvent.roster_year ? `, ${activeEvent.roster_year}` : ""})`
                  : "No event yet."}
              </p>
            </div>
            <div className="w-full sm:max-w-xs">
              <label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Switch event
                <select
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                  value={selectedEventId}
                  onChange={(event) => setSelectedEventId(event.target.value)}
                >
                  {events.length === 0 && <option value="">No events</option>}
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold">Shows</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Create a show (card) to group multiple rumbles and matches.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-[2fr,1fr]">
              <div className="space-y-3">
                <input
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                  placeholder="Show name"
                  value={showName}
                  onChange={(event) => setShowName(event.target.value)}
                />
                <input
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                  type="datetime-local"
                  value={showStartsAt}
                  onChange={(event) => setShowStartsAt(event.target.value)}
                />
                <button
                  className="inline-flex h-11 items-center justify-center rounded-full border border-amber-400 px-6 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                  type="button"
                  onClick={handleCreateShow}
                >
                  Create show
                </button>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  Existing shows
                </p>
                {shows.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-400">
                    No shows yet.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm text-zinc-200">
                    {shows.map((show) => (
                      <li key={show.id} className="flex items-center justify-between">
                        <span>{show.name}</span>
                        <span className="text-xs text-zinc-500">
                          {show.starts_at
                            ? new Date(show.starts_at).toLocaleString()
                            : "No date"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold">Create event</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Add a new rumble event and define its roster settings.
            </p>
            <div className="mt-4 space-y-3">
              <input
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                placeholder="Event name"
                value={eventName}
                onChange={(event) => setEventName(event.target.value)}
              />
              <input
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                type="datetime-local"
                value={eventStartsAt}
                onChange={(event) => setEventStartsAt(event.target.value)}
              />
              <select
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                value={eventShowId}
                onChange={(event) => setEventShowId(event.target.value)}
              >
                <option value="">Assign to show (optional)</option>
                {shows.map((show) => (
                  <option key={show.id} value={show.id}>
                    {show.name}
                  </option>
                ))}
              </select>
              <button
                className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-700 px-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-amber-300 hover:text-amber-200"
                type="button"
                onClick={() =>
                  setEventStartsAt(formatLocalDateTime(new Date().toISOString()))
                }
              >
                Use current time
              </button>
              <select
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                value={eventGender}
                onChange={(event) => setEventGender(event.target.value)}
              >
                <option value="men">Men's Rumble</option>
                <option value="women">Women's Rumble</option>
              </select>
              <input
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                type="number"
                min="1900"
                max="2100"
                placeholder="Roster year (e.g. 2020)"
                value={eventRosterYear}
                onChange={(event) => setEventRosterYear(event.target.value)}
              />
              <button
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-amber-400 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
                type="button"
                onClick={handleCreateEvent}
              >
                Create event
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold">Edit event</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Update the active event, manage custom entrants, and approve user
              submissions.
            </p>
            {!activeEvent ? (
              <p className="mt-4 text-sm text-zinc-400">
                Select an event to edit.
              </p>
            ) : (
              <>
                <div className="mt-4 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                    Event details
                  </p>
                  <input
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                    type="datetime-local"
                    value={eventStartsAt}
                    onChange={(event) => setEventStartsAt(event.target.value)}
                  />
                  <input
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                    type="number"
                    min="1900"
                    max="2100"
                    placeholder="Roster year (e.g. 2020)"
                    value={eventRosterYear}
                    onChange={(event) => setEventRosterYear(event.target.value)}
                  />
                  <select
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                    value={eventShowId}
                    onChange={(event) => setEventShowId(event.target.value)}
                  >
                    <option value="">Assign to show (optional)</option>
                    {shows.map((show) => (
                      <option key={show.id} value={show.id}>
                        {show.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-amber-300 hover:text-amber-200"
                      type="button"
                      onClick={() =>
                        setEventStartsAt(
                          formatLocalDateTime(new Date().toISOString())
                        )
                      }
                    >
                      Use current time
                    </button>
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full border border-amber-400 px-5 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
                      type="button"
                      onClick={handleUpdateEvent}
                      disabled={eventUpdateBusy}
                    >
                      {eventUpdateBusy ? "Saving..." : "Save updates"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                    Add custom entrant
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      className="h-11 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                      placeholder="Custom entrant name"
                      value={customEntrantName}
                      onChange={(event) =>
                        setCustomEntrantName(event.target.value)
                      }
                    />
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full border border-amber-400 px-4 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                      type="button"
                      onClick={handleAddCustomEntrant}
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                    Custom entrant approvals
                  </p>
                  {pendingEntrants.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-400">
                      No pending entrants.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {pendingEntrants.map((entrant) => (
                        <div
                          key={entrant.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3"
                        >
                          <EntrantCard
                            name={entrant.name}
                            promotion={entrant.promotion}
                            imageUrl={entrant.image_url}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              className="inline-flex h-9 items-center justify-center rounded-full border border-emerald-400 px-4 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
                              type="button"
                              onClick={() =>
                                handleApproveCustomEntrant(entrant.id)
                              }
                            >
                              Approve
                            </button>
                            <button
                              className="inline-flex h-9 items-center justify-center rounded-full border border-red-500/70 px-4 text-xs font-semibold uppercase tracking-wide text-red-200 transition hover:border-red-400 hover:text-red-100"
                              type="button"
                              onClick={() =>
                                handleRejectCustomEntrant(entrant.id)
                              }
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Rumble Entry</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {entries.length} entries tracked • {filteredEntrantOptions.length} eligible{" "}
            {activeEvent?.rumble_gender ? `(${activeEvent.rumble_gender})` : ""}
          </p>
          <div className="mt-4 space-y-3">
            <select
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={entryEntrantId}
              onChange={(event) => setEntryEntrantId(event.target.value)}
            >
              <option value="">Select entrant</option>
              {Object.entries(entrantsByPromotion)
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
                  <optgroup key={promotion} label={promotion}>
                    {promotionEntrants.map((entrant) => (
                      <option key={entrant.id} value={entrant.id}>
                        {eventEntrantIdSet.has(entrant.id)
                          ? `✓ ${entrant.name} — ADDED`
                          : entrant.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
            <input
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              placeholder="Entry number (optional)"
              value={entryNumber}
              onChange={(event) => setEntryNumber(event.target.value)}
            />
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-full border border-zinc-700 text-sm font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-200"
              type="button"
              onClick={handleAddEntry}
            >
              Add entry
            </button>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Matches</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Add matches for the event and assign participants.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[2fr,1fr,1fr,auto]">
            <input
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              placeholder="Match name"
              value={matchName}
              onChange={(event) => setMatchName(event.target.value)}
            />
            <input
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              placeholder="Kind (match, title, tag)"
              value={matchKind}
              onChange={(event) => setMatchKind(event.target.value)}
            />
            <select
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={matchType}
              onChange={(event) => setMatchType(event.target.value)}
            >
              <option value="singles">Singles (1 vs 1)</option>
              <option value="tag">Tag (2 vs 2)</option>
              <option value="triple_threat">Triple Threat</option>
              <option value="fatal_4_way">Fatal 4-Way</option>
              <option value="multi">Multi-person</option>
            </select>
            <button
              className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-700 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-200"
              type="button"
              onClick={handleAddMatch}
            >
              Add match
            </button>
          </div>

          {matches.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-400">No matches added yet.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {matches.map((match) => {
                const sides = matchSidesByMatch[match.id] ?? [];
                const participantRows = matchEntrantsByMatch[match.id] ?? [];
                const sideEntries = sides.map((side, index) => {
                  const entrantsForSide = participantRows
                    .filter((row) => row.side_id === side.id)
                    .map((row) => entrantMap.get(row.entrant_id))
                    .filter(Boolean) as EntrantRow[];
                  const label =
                    side.label?.trim() || `Side ${index + 1}`;
                  return { side, label, entrants: entrantsForSide };
                });
                const allEntrants = participantRows
                  .map((row) => entrantMap.get(row.entrant_id))
                  .filter(Boolean) as EntrantRow[];
                const sortedEntrants = [...allEntrants].sort((a, b) =>
                  a.name.localeCompare(b.name)
                );
                const finishState = matchFinishEdits[match.id] ?? {
                  method: match.finish_method ?? "",
                  winner: match.finish_winner_entrant_id ?? "",
                  loser: match.finish_loser_entrant_id ?? "",
                };
                const finishRequiresEntrants =
                  finishState.method === "pinfall" ||
                  finishState.method === "submission";
                const selection = matchEntrantSelection[match.id] ?? "";
                const sideSelection = matchSideSelection[match.id] ?? "";
                return (
                  <div
                    key={match.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                          {match.kind} · {match.match_type.replace("_", " ")}
                        </p>
                        <label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                          Match name
                          <div className="mt-2 flex flex-wrap gap-2">
                            <input
                              className="h-10 min-w-[220px] flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                              value={matchNameEdits[match.id] ?? match.name}
                              onChange={(event) =>
                                setMatchNameEdits((prev) => ({
                                  ...prev,
                                  [match.id]: event.target.value,
                                }))
                              }
                            />
                            <button
                              className="inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                              type="button"
                              onClick={() =>
                                handleUpdateMatchName(
                                  match.id,
                                  matchNameEdits[match.id] ?? match.name
                                )
                              }
                            >
                              Save match
                            </button>
                          </div>
                        </label>
                        <p className="text-xs text-zinc-500">
                          Edit the match name and click “Save match”.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <select
                          className="h-10 min-w-[220px] rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                          value={match.winner_side_id ?? ""}
                          onChange={(event) =>
                            handleSetMatchWinner(match.id, event.target.value)
                          }
                        >
                          <option value="">Select winner</option>
                          {sideEntries.map(({ side, label, entrants }) => (
                            <option key={side.id} value={side.id}>
                              {label}
                              {entrants.length > 0
                                ? ` — ${entrants.map((entrant) => entrant.name).join(", ")}`
                                : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          className="inline-flex h-10 items-center justify-center rounded-full border border-red-500/60 px-4 text-[10px] font-semibold uppercase tracking-wide text-red-200 transition hover:border-red-400 hover:text-red-100"
                          type="button"
                          onClick={() => handleDeleteMatch(match.id)}
                        >
                          Delete match
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3">
                      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                        Match finish (only for matches with 3+ entrants)
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <select
                          className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                          value={finishState.method}
                          onChange={(event) =>
                            setMatchFinishEdits((prev) => ({
                              ...prev,
                              [match.id]: {
                                ...finishState,
                                method: event.target.value,
                              },
                            }))
                          }
                        >
                          <option value="">Select finish</option>
                          <option value="pinfall">Pinfall</option>
                          <option value="submission">Submission</option>
                          <option value="disqualification">Disqualification</option>
                        </select>
                        <select
                          className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                          value={finishState.winner}
                          onChange={(event) =>
                            setMatchFinishEdits((prev) => ({
                              ...prev,
                              [match.id]: {
                                ...finishState,
                                winner: event.target.value,
                              },
                            }))
                          }
                          disabled={!finishRequiresEntrants}
                        >
                          <option value="">Winner (pin/sub)</option>
                          {sortedEntrants.map((entrant) => (
                            <option key={entrant.id} value={entrant.id}>
                              {entrant.name}
                            </option>
                          ))}
                        </select>
                        <select
                          className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                          value={finishState.loser}
                          onChange={(event) =>
                            setMatchFinishEdits((prev) => ({
                              ...prev,
                              [match.id]: {
                                ...finishState,
                                loser: event.target.value,
                              },
                            }))
                          }
                          disabled={!finishRequiresEntrants}
                        >
                          <option value="">Loser (pin/sub)</option>
                          {sortedEntrants.map((entrant) => (
                            <option key={entrant.id} value={entrant.id}>
                              {entrant.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                        <span>
                          {allEntrants.length <= 2
                            ? "Finish scoring is disabled for singles/tag matches."
                            : "Set the finish to score these picks."}
                        </span>
                        <button
                          className="inline-flex h-9 items-center justify-center rounded-full border border-amber-400 px-4 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                          type="button"
                          onClick={() =>
                            handleSetMatchFinish(
                              match.id,
                              finishState.method,
                              finishState.winner,
                              finishState.loser
                            )
                          }
                        >
                          Save finish
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                      <select
                        className="h-10 min-w-[200px] rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                        value={sideSelection}
                        onChange={(event) =>
                          setMatchSideSelection((prev) => ({
                            ...prev,
                            [match.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select side</option>
                        {sideEntries.map(({ side, label }) => (
                          <option key={side.id} value={side.id}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-10 min-w-[240px] rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                        value={selection}
                        onChange={(event) =>
                          setMatchEntrantSelection((prev) => ({
                            ...prev,
                            [match.id]: event.target.value,
                          }))
                        }
                      >
                        <option value="">Add participant</option>
                        {filteredEntrantOptions.map((entrant) => (
                          <option key={entrant.id} value={entrant.id}>
                            {entrant.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-200"
                        type="button"
                        onClick={() => {
                          if (!selection || !sideSelection) return;
                          handleAddMatchEntrant(match.id, selection, sideSelection);
                          setMatchEntrantSelection((prev) => ({
                            ...prev,
                            [match.id]: "",
                          }));
                          setMatchSideSelection((prev) => ({
                            ...prev,
                            [match.id]: "",
                          }));
                        }}
                      >
                        Add participant
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-4 text-xs font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-200"
                        type="button"
                        onClick={() => handleAddMatchSide(match.id)}
                      >
                        Add side
                      </button>
                    </div>

                    {sideEntries.length === 0 ? (
                      <p className="mt-3 text-xs text-zinc-500">
                        No sides added yet.
                      </p>
                    ) : (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {sideEntries.map(({ side, label, entrants }) => (
                          <div
                            key={side.id}
                            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <input
                                className="h-9 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-100"
                                value={matchSideLabelEdits[side.id] ?? label}
                                onChange={(event) =>
                                  setMatchSideLabelEdits((prev) => ({
                                    ...prev,
                                    [side.id]: event.target.value,
                                  }))
                                }
                              />
                              <button
                                className="inline-flex h-9 items-center justify-center rounded-full border border-amber-400 px-3 text-[10px] font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                                type="button"
                                onClick={() =>
                                  handleUpdateMatchSideLabel(
                                    side.id,
                                    matchSideLabelEdits[side.id] ?? label
                                  )
                                }
                              >
                                Save
                              </button>
                            </div>
                            {entrants.length === 0 ? (
                              <p className="mt-3 text-xs text-zinc-500">
                                No participants yet.
                              </p>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {entrants.map((entrant) => (
                                  <div
                                    key={entrant.id}
                                    className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                                  >
                                    <EntrantCard
                                      name={entrant.name}
                                      promotion={entrant.promotion}
                                      imageUrl={entrant.image_url}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Eliminations</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Mark eliminations to keep the live scoreboard up to date.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <select
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={eliminateEntryId}
              onChange={(event) => setEliminateEntryId(event.target.value)}
            >
              <option value="">Select eliminated entrant</option>
              {entries.map((entry) => {
                const entrant = entrants.find(
                  (candidate) => candidate.id === entry.entrant_id
                );
                return (
                  <option key={entry.id} value={entry.id}>
                    {entrant?.name ?? "Unknown entrant"}
                  </option>
                );
              })}
            </select>
            <select
              className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={eliminatedById}
              onChange={(event) => setEliminatedById(event.target.value)}
            >
              <option value="">Eliminated by (optional)</option>
              {eventEntrantOptions.map((entrant) => (
                <option key={entrant.id} value={entrant.id}>
                  {entrant.name}
                </option>
              ))}
            </select>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-amber-400 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
              type="button"
              onClick={handleElimination}
            >
              Record elimination
            </button>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Active Event Entries</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Edit entry numbers, eliminations, or the credited eliminator.
          </p>
          <div className="mt-6 max-h-[420px] space-y-4 overflow-y-auto pr-1">
            {entries.length === 0 ? (
              <p className="text-sm text-zinc-400">No entries yet.</p>
            ) : (
              entries.map((entry) => {
                const entrant = entrantMap.get(entry.entrant_id);
                return (
                  <div
                    key={entry.id}
                    className={`rounded-2xl border p-4 ${
                      entry.eliminated_at
                        ? "border-red-500/60 bg-red-500/5"
                        : "border-zinc-800 bg-zinc-950/60"
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <EntrantCard
                          name={entrant?.name ?? "Unknown entrant"}
                          promotion={entrant?.promotion ?? "Unknown promotion"}
                          imageUrl={entrant?.image_url}
                        />
                        {entry.eliminated_at ? (
                          <span className="rounded-full border border-red-500/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                            Eliminated
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex flex-col text-xs text-zinc-400">
                          Entry #
                          <input
                            className="mt-1 h-10 w-24 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                            value={entry.entry_number ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setEntries((prev) =>
                                prev.map((item) =>
                                  item.id === entry.id
                                    ? {
                                        ...item,
                                        entry_number:
                                          value === ""
                                            ? null
                                            : Number(value),
                                      }
                                    : item
                                )
                              );
                            }}
                          />
                        </label>
                        <label className="flex flex-col text-xs text-zinc-400">
                          Eliminations
                          <input
                            className="mt-1 h-10 w-28 rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                            value={entry.eliminations_count ?? 0}
                            onChange={(event) => {
                              const value = event.target.value;
                              setEntries((prev) =>
                                prev.map((item) =>
                                  item.id === entry.id
                                    ? {
                                        ...item,
                                        eliminations_count:
                                          value === ""
                                            ? 0
                                            : Number(value),
                                      }
                                    : item
                                )
                              );
                            }}
                          />
                        </label>
                        <label className="flex flex-col text-xs text-zinc-400">
                          Eliminated by
                          <select
                            className="mt-1 h-10 min-w-[200px] rounded-xl border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100"
                            value={entry.eliminated_by ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setEntries((prev) =>
                                prev.map((item) =>
                                  item.id === entry.id
                                    ? {
                                        ...item,
                                        eliminated_by: value || null,
                                      }
                                    : item
                                )
                              );
                            }}
                          >
                            <option value="">Not set</option>
                            {eventEntrantOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="mt-5 h-10 rounded-full border border-amber-400 px-4 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-200 hover:text-amber-100"
                          type="button"
                          onClick={() => handleUpdateEntry(entry)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Scoring</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Recalculate scores after updating eliminations or results.
          </p>
          <div className="mt-4">
            <button
              className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
              onClick={handleRecalculateScores}
              disabled={recalcBusy}
            >
              {recalcBusy ? "Recalculating…" : "Recalculate scores"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
