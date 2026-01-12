"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type EventRow = {
  id: string;
  name: string;
  status: string;
  starts_at: string | null;
};

type EntrantRow = {
  id: string;
  name: string;
  promotion: string | null;
  active: boolean;
};

type RumbleEntryRow = {
  id: string;
  entrant_id: string;
  entry_number: number | null;
  eliminated_by: string | null;
  eliminated_at: string | null;
  eliminations_count: number;
};

export default function AdminPage() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [entrants, setEntrants] = useState<EntrantRow[]>([]);
  const [entries, setEntries] = useState<RumbleEntryRow[]>([]);

  const [eventName, setEventName] = useState("");
  const [entrantName, setEntrantName] = useState("");
  const [entrantPromotion, setEntrantPromotion] = useState("");
  const [entryEntrantId, setEntryEntrantId] = useState("");
  const [entryNumber, setEntryNumber] = useState("");
  const [eliminateEntryId, setEliminateEntryId] = useState("");
  const [eliminatedById, setEliminatedById] = useState("");

  const activeEvent = useMemo(() => events[0] ?? null, [events]);
  const entrantOptions = useMemo(() => {
    const byName = new Map<string, EntrantRow>();
    entrants.forEach((entrant) => {
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
  }, [entrants]);

  const refreshData = async () => {
    if (!activeEvent) {
      const { data: eventRows } = await supabase
        .from("events")
        .select("id, name, status, starts_at")
        .order("created_at", { ascending: false });
      setEvents(eventRows ?? []);
    } else {
      const [{ data: eventRows }, { data: entrantRows }, { data: entryRows }] =
        await Promise.all([
          supabase
            .from("events")
            .select("id, name, status, starts_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("entrants")
            .select("id, name, promotion, active")
            .order("name", { ascending: true }),
          supabase
            .from("rumble_entries")
            .select(
              "id, entrant_id, entry_number, eliminated_by, eliminated_at, eliminations_count"
            )
            .eq("event_id", activeEvent.id)
            .order("entry_number", { ascending: true }),
        ]);
      setEvents(eventRows ?? []);
      setEntrants(entrantRows ?? []);
      setEntries(entryRows ?? []);
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
  }, [isAdmin, activeEvent?.id]);

  const handleCreateEvent = async () => {
    setMessage(null);
    if (!eventName.trim()) {
      setMessage("Event name is required.");
      return;
    }
    const { error } = await supabase
      .from("events")
      .insert({ name: eventName.trim(), status: "draft" });
    if (error) {
      setMessage(error.message);
      return;
    }
    setEventName("");
    refreshData();
  };

  const handleCreateEntrant = async () => {
    setMessage(null);
    if (!entrantName.trim()) {
      setMessage("Entrant name is required.");
      return;
    }
    const { error } = await supabase.from("entrants").insert({
      name: entrantName.trim(),
      promotion: entrantPromotion.trim() || null,
      active: true,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setEntrantName("");
    setEntrantPromotion("");
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
    setEliminateEntryId("");
    setEliminatedById("");
    refreshData();
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

        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold">Event</h2>
            <p className="mt-2 text-sm text-zinc-400">
              {activeEvent
                ? `Active: ${activeEvent.name}`
                : "No event yet."}
            </p>
            <div className="mt-4 space-y-3">
              <input
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                placeholder="Event name"
                value={eventName}
                onChange={(event) => setEventName(event.target.value)}
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
            <h2 className="text-lg font-semibold">Entrant</h2>
            <p className="mt-2 text-sm text-zinc-400">
              {entrants.length} total entrants
            </p>
            <div className="mt-4 space-y-3">
              <input
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                placeholder="Entrant name"
                value={entrantName}
                onChange={(event) => setEntrantName(event.target.value)}
              />
              <input
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                placeholder="Promotion (optional)"
                value={entrantPromotion}
                onChange={(event) => setEntrantPromotion(event.target.value)}
              />
              <button
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-amber-400 text-sm font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-200 hover:text-amber-100"
                type="button"
                onClick={handleCreateEntrant}
              >
                Add entrant
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-lg font-semibold">Rumble Entry</h2>
            <p className="mt-2 text-sm text-zinc-400">
              {entries.length} entries tracked
            </p>
            <div className="mt-4 space-y-3">
              <select
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                value={entryEntrantId}
                onChange={(event) => setEntryEntrantId(event.target.value)}
              >
                <option value="">Select entrant</option>
                {entrantOptions.map((entrant) => (
                  <option key={entrant.id} value={entrant.id}>
                    {entrant.name}
                  </option>
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
          </div>
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
              {entrantOptions.map((entrant) => (
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
      </main>
    </div>
  );
}
