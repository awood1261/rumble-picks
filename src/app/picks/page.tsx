"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type PicksPayload = {
  entrants: string[];
  final_four: string[];
  winner: string | null;
  entry_1: string | null;
  entry_2: string | null;
  entry_30: string | null;
  most_eliminations: string | null;
};

type RumbleEntryRow = {
  entrant_id: string;
  entry_number: number | null;
  eliminated_at: string | null;
  eliminations_count: number;
};

const emptyPayload: PicksPayload = {
  entrants: [],
  final_four: [],
  winner: null,
  entry_1: null,
  entry_2: null,
  entry_30: null,
  most_eliminations: null,
};

export default function PicksPage() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [entrants, setEntrants] = useState<EntrantRow[]>([]);
  const [rumbleEntries, setRumbleEntries] = useState<RumbleEntryRow[]>([]);
  const [payload, setPayload] = useState<PicksPayload>(emptyPayload);
  const [saving, setSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [rankInfo, setRankInfo] = useState<{ rank: number | null; total: number }>(
    { rank: null, total: 0 }
  );
  const [customEntrantName, setCustomEntrantName] = useState("");
  const [entrantSearch, setEntrantSearch] = useState("");
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const keyPicksRef = useRef<HTMLDivElement | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [editSection, setEditSection] = useState<
    "entrants" | "final_four" | "key_picks" | null
  >(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );
  const isLocked = useMemo(() => {
    if (!selectedEvent?.starts_at) return false;
    return new Date() >= new Date(selectedEvent.starts_at);
  }, [selectedEvent?.starts_at]);

  const lockInfo = useMemo(() => {
    if (!selectedEvent?.starts_at) {
      return {
        label: "Lock time not set",
        detail: "Picks stay editable until a start time is added.",
      };
    }
    const startTime = new Date(selectedEvent.starts_at).getTime();
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
        detail: "You can edit picks until the event start time.",
      };
    }
    return {
      label: `Locked ${timeString} ago`,
      detail: "Picks are locked once the event starts.",
    };
  }, [selectedEvent?.starts_at, now]);

  const entrantOptions = useMemo(() => {
    const gender = selectedEvent?.rumble_gender;
    const byName = new Map<string, EntrantRow>();
    entrants
      .filter((entrant) => {
        const matchesGender = !gender || entrant.gender === gender;
        const matchesYear =
          !selectedEvent?.roster_year ||
          entrant.roster_year === selectedEvent.roster_year;
        const matchesEvent =
          !selectedEvent?.id || entrant.event_id === selectedEvent.id;
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
    return Array.from(byName.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [entrants, selectedEvent?.rumble_gender]);

  const entrantById = useMemo(() => {
    return new Map(entrantOptions.map((entrant) => [entrant.id, entrant]));
  }, [entrantOptions]);

  const selectedEntrantOptions = useMemo(() => {
    const selected = new Set(payload.entrants);
    return entrantOptions.filter((entrant) => selected.has(entrant.id));
  }, [entrantOptions, payload.entrants]);

  const entrantsByPromotion = useMemo(() => {
    return entrantOptions.reduce((groups, entrant) => {
      const key = entrant.promotion ?? "Other";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(entrant);
      return groups;
    }, {} as Record<string, EntrantRow[]>);
  }, [entrantOptions]);

  const filteredEntrantsByPromotion = useMemo(() => {
    const query = entrantSearch.trim().toLowerCase();
    if (!query) return entrantsByPromotion;
    const filtered: Record<string, EntrantRow[]> = {};
    Object.entries(entrantsByPromotion).forEach(([promotion, list]) => {
      const matches = list.filter((entrant) =>
        entrant.name.toLowerCase().includes(query)
      );
      if (matches.length > 0) {
        filtered[promotion] = matches;
      }
    });
    return filtered;
  }, [entrantSearch, entrantsByPromotion]);

  const filteredEntrantCount = useMemo(() => {
    return Object.values(filteredEntrantsByPromotion).reduce(
      (total, list) => total + list.length,
      0
    );
  }, [filteredEntrantsByPromotion]);

  const sameArray = (a: string[], b: string[]) =>
    a.length === b.length && a.every((value, index) => value === b[index]);

  const getEliminationKey = (entry: RumbleEntryRow) =>
    entry.eliminated_at
      ? new Date(entry.eliminated_at).getTime()
      : Number.MAX_SAFE_INTEGER;

  const actuals = useMemo(() => {
    const entrantSet = new Set(rumbleEntries.map((entry) => entry.entrant_id));
    const finalFour = [...rumbleEntries]
      .sort((a, b) => getEliminationKey(b) - getEliminationKey(a))
      .slice(0, 4)
      .map((entry) => entry.entrant_id);
    const winners = rumbleEntries.filter((entry) => !entry.eliminated_at);
    const winner =
      rumbleEntries.length >= 30 && winners.length === 1
        ? winners[0].entrant_id
        : null;
    const entry1 =
      rumbleEntries.find((entry) => entry.entry_number === 1)?.entrant_id ??
      null;
    const entry2 =
      rumbleEntries.find((entry) => entry.entry_number === 2)?.entrant_id ??
      null;
    const entry30 =
      rumbleEntries.find((entry) => entry.entry_number === 30)?.entrant_id ??
      null;
    const maxElims = rumbleEntries.reduce(
      (max, entry) => Math.max(max, entry.eliminations_count ?? 0),
      0
    );
    const topElims = new Set(
      rumbleEntries
        .filter((entry) => entry.eliminations_count === maxElims)
        .map((entry) => entry.entrant_id)
    );

    return {
      entrantSet,
      finalFourSet: new Set(finalFour),
      winner,
      entry1,
      entry2,
      entry30,
      topElims,
      hasData: rumbleEntries.length > 0,
    };
  }, [rumbleEntries]);

  const sectionPoints = useMemo(() => {
    if (!actuals.hasData) {
      return {
        entrants: null,
        finalFour: null,
        keyPicks: null,
      };
    }

    const entrantsCorrect = payload.entrants.filter((id) =>
      actuals.entrantSet.has(id)
    ).length;
    const finalFourCorrect = payload.final_four.filter((id) =>
      actuals.finalFourSet.has(id)
    ).length;
    const keyPicksTotal =
      (payload.winner && payload.winner === actuals.winner
        ? scoringRules.winner
        : 0) +
      (payload.entry_1 && payload.entry_1 === actuals.entry1
        ? scoringRules.entry_1
        : 0) +
      (payload.entry_2 && payload.entry_2 === actuals.entry2
        ? scoringRules.entry_2
        : 0) +
      (payload.entry_30 && payload.entry_30 === actuals.entry30
        ? scoringRules.entry_30
        : 0) +
      (payload.most_eliminations &&
      actuals.topElims.has(payload.most_eliminations)
        ? scoringRules.most_eliminations
        : 0);

    return {
      entrants: entrantsCorrect * scoringRules.entrants,
      finalFour: finalFourCorrect * scoringRules.final_four,
      keyPicks: keyPicksTotal,
    };
  }, [actuals, payload]);

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
    supabase
      .from("events")
      .select("id, name, starts_at, status, rumble_gender, roster_year")
      .order("starts_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setMessage(error.message);
          return;
        }
        setEvents(data ?? []);
        if (data && data.length > 0) {
          setSelectedEventId((prev) => prev || data[0].id);
        }
      });
  }, [sessionEmail]);

  useEffect(() => {
    if (!selectedEvent?.starts_at) return;
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [selectedEvent?.starts_at]);

  useEffect(() => {
    if (!selectedEventId || !userId) return;
    setMessage(null);
    setPayload(emptyPayload);
    setHasSaved(false);
    setEditSection(null);

    const loadEventData = async () => {
      const [
        { data: pickRows },
        { data: entrantRows, error: entrantError },
        { data: entryRows, error: entryError },
      ] = await Promise.all([
          supabase
            .from("picks")
            .select("payload")
            .eq("event_id", selectedEventId)
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("entrants")
            .select(
              "id, name, promotion, gender, image_url, roster_year, event_id, is_custom, created_by, status"
            )
            .order("name", { ascending: true }),
          supabase
            .from("rumble_entries")
            .select("entrant_id, entry_number, eliminated_at, eliminations_count")
            .eq("event_id", selectedEventId),
        ]);

      if (entrantError) {
        setMessage(entrantError.message);
        return;
      }

      if (entryError) {
        setMessage(entryError.message);
        return;
      }

      setEntrants(entrantRows ?? []);
      setRumbleEntries(entryRows ?? []);

      const savedPayload = pickRows?.payload as Partial<PicksPayload> | null;
      if (savedPayload) {
        setPayload({
          entrants: savedPayload.entrants ?? [],
          final_four: savedPayload.final_four ?? [],
          winner: savedPayload.winner ?? null,
          entry_1: savedPayload.entry_1 ?? null,
          entry_2: savedPayload.entry_2 ?? null,
          entry_30: savedPayload.entry_30 ?? null,
          most_eliminations: savedPayload.most_eliminations ?? null,
        });
        setHasSaved(true);
      }
    };

    loadEventData();
  }, [selectedEventId, userId]);

  useEffect(() => {
    if (!selectedEventId || !userId) return;

    let ignore = false;
    const loadRank = async () => {
      const { data, error } = await supabase
        .from("scores")
        .select("user_id, points")
        .eq("event_id", selectedEventId)
        .order("points", { ascending: false });

      if (ignore) return;
      if (error || !data) {
        setRankInfo({ rank: null, total: 0 });
        return;
      }

      const total = data.length;
      const index = data.findIndex((row) => row.user_id === userId);
      setRankInfo({ rank: index === -1 ? null : index + 1, total });
    };

    loadRank();
    return () => {
      ignore = true;
    };
  }, [selectedEventId, userId]);

  useEffect(() => {
    const selected = new Set(payload.entrants);
    setPayload((prev) => {
      const next = {
        ...prev,
        final_four: prev.final_four.filter((id) => selected.has(id)),
        winner: prev.winner && selected.has(prev.winner) ? prev.winner : null,
        entry_1:
          prev.entry_1 && selected.has(prev.entry_1) ? prev.entry_1 : null,
        entry_2:
          prev.entry_2 && selected.has(prev.entry_2) ? prev.entry_2 : null,
        entry_30:
          prev.entry_30 && selected.has(prev.entry_30) ? prev.entry_30 : null,
        most_eliminations:
          prev.most_eliminations && selected.has(prev.most_eliminations)
            ? prev.most_eliminations
            : null,
      };

      const unchanged =
        sameArray(prev.final_four, next.final_four) &&
        prev.winner === next.winner &&
        prev.entry_1 === next.entry_1 &&
        prev.entry_2 === next.entry_2 &&
        prev.entry_30 === next.entry_30 &&
        prev.most_eliminations === next.most_eliminations;

      return unchanged ? prev : next;
    });
  }, [payload.entrants]);

  useEffect(() => {
    if (editSection !== "key_picks") return;
    keyPicksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editSection]);

  const toggleEntrant = (id: string) => {
    setPayload((prev) => {
      const exists = prev.entrants.includes(id);
      if (exists) {
        return { ...prev, entrants: prev.entrants.filter((item) => item !== id) };
      }
      if (prev.entrants.length >= 30) {
        setMessage("You can only select up to 30 entrants.");
        return prev;
      }
      return { ...prev, entrants: [...prev.entrants, id] };
    });
  };

  const toggleFinalFour = (id: string) => {
    setPayload((prev) => {
      const exists = prev.final_four.includes(id);
      if (exists) {
        return {
          ...prev,
          final_four: prev.final_four.filter((item) => item !== id),
        };
      }
      if (prev.final_four.length >= 4) {
        setMessage("Final four is limited to 4 picks.");
        return prev;
      }
      return { ...prev, final_four: [...prev.final_four, id] };
    });
  };

  const handleAddCustomEntrant = async () => {
    if (!userId || !selectedEventId) return;
    if (isLocked) {
      setMessage("Picks are locked for this event.");
      return;
    }
    const trimmed = customEntrantName.trim();
    if (!trimmed) {
      setMessage("Custom entrant name is required.");
      return;
    }
    const normalized = trimmed.toLowerCase();
    const existing = entrantOptions.find(
      (entrant) => entrant.name.trim().toLowerCase() === normalized
    );
    if (existing) {
      setMessage("That entrant is already in the list.");
      if (!payload.entrants.includes(existing.id)) {
        toggleEntrant(existing.id);
      }
      setCustomEntrantName("");
      return;
    }
    const { data, error } = await supabase
      .from("entrants")
      .insert({
        name: trimmed,
        promotion: "Custom",
        gender: selectedEvent?.rumble_gender ?? null,
        roster_year: selectedEvent?.roster_year ?? null,
        event_id: selectedEventId,
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
        if (prev.entrants.length >= 30) return prev;
        return { ...prev, entrants: [...prev.entrants, data.id] };
      });
      setMessage("Custom entrant added.");
    }
    setCustomEntrantName("");
    setCustomModalOpen(false);
  };

  const handleSave = async () => {
    if (!userId || !selectedEventId) return;
    if (isLocked) {
      setMessage("Picks are locked for this event.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from("picks").upsert(
      {
        user_id: userId,
        event_id: selectedEventId,
        payload,
      },
      { onConflict: "user_id,event_id" }
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
    id ? entrantById.get(id) ?? null : null;

  const renderPickList = (
    ids: string[],
    correctSet: Set<string>,
    points: number
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
            const isCorrect = actuals.hasData && correctSet.has(id);
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
                  !actuals.hasData
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
                {actuals.hasData && (
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
            Choose an event and lock in your rumble picks before bell time.
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
                Your rank will appear once scores are calculated for this event.
              </span>
            )}
          </div>
        )}
        {isLocked && (
          <div className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            Picks are locked for this event.
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/50 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <label className="text-sm text-zinc-300">
            Event
            <select
              className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
            >
              {events.length === 0 && <option value="">No events yet</option>}
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        {entrantOptions.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <p className="text-sm text-zinc-400">
              No entrants are available yet.
            </p>
          </section>
        ) : hasSaved && !editSection ? (
          <section className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Entrants</h2>
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
                {payload.entrants.length} selected
              </p>
              {sectionPoints.entrants !== null && (
                <p className="mt-1 text-xs text-emerald-200">
                  Points: {sectionPoints.entrants}
                </p>
              )}
              {renderPickList(
                payload.entrants,
                actuals.entrantSet,
                scoringRules.entrants
              )}
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Final Four</h2>
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
                {payload.final_four.length} selected
              </p>
              {sectionPoints.finalFour !== null && (
                <p className="mt-1 text-xs text-emerald-200">
                  Points: {sectionPoints.finalFour}
                </p>
              )}
              {renderPickList(
                payload.final_four,
                actuals.finalFourSet,
                scoringRules.final_four
              )}
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Key Picks</h2>
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
              {sectionPoints.keyPicks !== null && (
                <p className="mt-2 text-xs text-emerald-200">
                  Points: {sectionPoints.keyPicks}
                </p>
              )}
              <div className="mt-4 space-y-3 text-sm text-zinc-200">
                {[
                  ["Winner", payload.winner, actuals.winner, scoringRules.winner],
                  ["Entry #1", payload.entry_1, actuals.entry1, scoringRules.entry_1],
                  ["Entry #2", payload.entry_2, actuals.entry2, scoringRules.entry_2],
                  ["Entry #30", payload.entry_30, actuals.entry30, scoringRules.entry_30],
                  [
                    "Most eliminations",
                    payload.most_eliminations,
                    null,
                    scoringRules.most_eliminations,
                  ],
                ].map(([label, value, actual, points]) => {
                  const entrant = value ? getEntrant(String(value)) : null;
                  const isCorrect =
                    actuals.hasData &&
                    (label === "Most eliminations"
                      ? value && actuals.topElims.has(String(value))
                      : value && actual === value);
                  return (
                    <div
                      key={label as string}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                        !actuals.hasData
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
                      {actuals.hasData && (
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
          </section>
        ) : (
          <>
            {(editSection === "entrants" || !hasSaved) && (
              <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Entrants</h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      Select up to 30. You have picked {payload.entrants.length}.
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
                    <p>
                      Don’t see an entrant? Add a custom one for this event.
                    </p>
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-full border border-amber-400 px-4 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      onClick={() => setCustomModalOpen(true)}
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
                    {filteredEntrantCount} entrant{filteredEntrantCount === 1 ? "" : "s"}
                    {entrantSearch ? " match your search." : " available."}
                  </p>
                </div>
                <div className="mt-4 max-h-[520px] space-y-6 overflow-y-auto pr-1">
                  <div className="sticky top-0 z-10 -mx-1 rounded-2xl border border-zinc-800 bg-zinc-950/90 px-4 py-2 text-xs text-zinc-300 backdrop-blur">
                    <div className="flex items-center justify-between">
                      <span>
                        Selected:{" "}
                        <span className="font-semibold text-amber-200">
                          {payload.entrants.length}/30
                        </span>
                      </span>
                      <span className="text-zinc-500">
                        {Math.max(30 - payload.entrants.length, 0)} remaining
                      </span>
                    </div>
                  </div>
                  {filteredEntrantCount === 0 ? (
                    <p className="text-sm text-zinc-400">
                      No entrants match your search.
                    </p>
                  ) : (
                    Object.entries(filteredEntrantsByPromotion)
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
                                payload.entrants.includes(entrant.id)
                                  ? "border-amber-400 bg-amber-400/10"
                                  : "border-zinc-800 bg-zinc-950/70"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={payload.entrants.includes(entrant.id)}
                                onChange={() => toggleEntrant(entrant.id)}
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
            )}

            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              {(editSection === "final_four" || !hasSaved) && (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Final Four</h2>
                      <p className="mt-2 text-sm text-zinc-400">
                        Select exactly 4. You have picked {payload.final_four.length}.
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
                    {selectedEntrantOptions.map((entrant) => (
                    <label
                      key={entrant.id}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                        payload.final_four.includes(entrant.id)
                          ? "border-amber-400 bg-amber-400/10"
                          : "border-zinc-800 bg-zinc-950/70"
                      }`}
                    >
                        <input
                          type="checkbox"
                          checked={payload.final_four.includes(entrant.id)}
                          onChange={() => toggleFinalFour(entrant.id)}
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
                </div>
              )}

              {(editSection === "key_picks" || !hasSaved) && (
                <div
                  ref={keyPicksRef}
                  className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
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
                          value={payload[field.key] ?? ""}
                          onChange={(event) =>
                            setPayload((prev) => ({
                              ...prev,
                              [field.key]: event.target.value || null,
                            }))
                          }
                          disabled={isLocked}
                        >
                          <option value="">Select</option>
                          {selectedEntrantOptions.map((entrant) => (
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
                </div>
              )}
            </section>

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
                  Your picks can be updated until the event locks.
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
                  onClick={() => setCustomModalOpen(false)}
                >
                  Close
                </button>
              </div>
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
                  onClick={() => setCustomModalOpen(false)}
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
