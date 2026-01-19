"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type EventRow = {
  id: string;
  name: string;
  starts_at: string | null;
  status: string;
};

type EntrantRow = {
  id: string;
  name: string;
  promotion: string | null;
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
  const [payload, setPayload] = useState<PicksPayload>(emptyPayload);
  const [saving, setSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [editSection, setEditSection] = useState<
    "entrants" | "final_four" | "key_picks" | null
  >(null);

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

  const entrantById = useMemo(() => {
    return new Map(entrantOptions.map((entrant) => [entrant.id, entrant]));
  }, [entrantOptions]);

  const selectedEntrantOptions = useMemo(() => {
    const selected = new Set(payload.entrants);
    return entrantOptions.filter((entrant) => selected.has(entrant.id));
  }, [entrantOptions, payload.entrants]);

  const sameArray = (a: string[], b: string[]) =>
    a.length === b.length && a.every((value, index) => value === b[index]);

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
      .select("id, name, starts_at, status")
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
    if (!selectedEventId || !userId) return;
    setMessage(null);
    setPayload(emptyPayload);
    setHasSaved(false);
    setEditSection(null);

    const loadEventData = async () => {
      const [{ data: pickRows }, { data: entrantRows, error: entrantError }] =
        await Promise.all([
          supabase
            .from("picks")
            .select("payload")
            .eq("event_id", selectedEventId)
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("entrants")
            .select("id, name, promotion")
            .order("name", { ascending: true }),
        ]);

      if (entrantError) {
        setMessage(entrantError.message);
        return;
      }

      setEntrants(entrantRows ?? []);

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

  const handleSave = async () => {
    if (!userId || !selectedEventId) return;
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

  const getName = (id: string | null) =>
    id ? entrantById.get(id)?.name ?? "Unknown" : "Not set";

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
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Rumble Picks
          </p>
          <h1 className="text-3xl font-semibold">Make your predictions</h1>
          <p className="text-sm text-zinc-400">
            Choose an event and lock in your rumble picks before bell time.
          </p>
        </header>

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
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100"
                  type="button"
                  onClick={() => setEditSection("entrants")}
                >
                  <EditIcon />
                  Edit
                </button>
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                {payload.entrants.length} selected
              </p>
              <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1 text-sm text-zinc-200">
                {payload.entrants
                  .map((id) => ({ id, name: getName(id) }))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((entrant) => (
                    <li
                      key={entrant.id}
                      className="rounded-xl border border-zinc-800 px-3 py-2"
                    >
                      {entrant.name}
                    </li>
                  ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Final Four</h2>
                <button
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100"
                  type="button"
                  onClick={() => setEditSection("final_four")}
                >
                  <EditIcon />
                  Edit
                </button>
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                {payload.final_four.length} selected
              </p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-200">
                {payload.final_four.map((id) => (
                  <li key={id} className="rounded-xl border border-zinc-800 px-3 py-2">
                    {getName(id)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Key Picks</h2>
                <button
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:text-amber-100"
                  type="button"
                  onClick={() => setEditSection("key_picks")}
                >
                  <EditIcon />
                  Edit
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-zinc-200">
                <div className="flex items-center justify-between rounded-xl border border-zinc-800 px-3 py-2">
                  <span className="text-zinc-400">Winner</span>
                  <span>{getName(payload.winner)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-zinc-800 px-3 py-2">
                  <span className="text-zinc-400">Entry #1</span>
                  <span>{getName(payload.entry_1)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-zinc-800 px-3 py-2">
                  <span className="text-zinc-400">Entry #2</span>
                  <span>{getName(payload.entry_2)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-zinc-800 px-3 py-2">
                  <span className="text-zinc-400">Entry #30</span>
                  <span>{getName(payload.entry_30)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-zinc-800 px-3 py-2">
                  <span className="text-zinc-400">Most eliminations</span>
                  <span>{getName(payload.most_eliminations)}</span>
                </div>
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
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {entrantOptions.map((entrant) => (
                    <label
                      key={entrant.id}
                      className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={payload.entrants.includes(entrant.id)}
                        onChange={() => toggleEntrant(entrant.id)}
                      />
                      <span className="flex-1">{entrant.name}</span>
                      <span className="text-xs text-zinc-500">
                        {entrant.promotion ?? "—"}
                      </span>
                    </label>
                  ))}
                </div>
                {hasSaved && (
                  <div className="mt-6">
                    <button
                      className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
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
                        className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={payload.final_four.includes(entrant.id)}
                          onChange={() => toggleFinalFour(entrant.id)}
                        />
                        <span className="flex-1">{entrant.name}</span>
                      </label>
                    ))}
                  </div>
                  {hasSaved && (
                    <div className="mt-6">
                      <button
                        className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? "Saving…" : "Save final four"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(editSection === "key_picks" || !hasSaved) && (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
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
                    {[
                      { label: "Winner", key: "winner" },
                      { label: "Entry #1", key: "entry_1" },
                      { label: "Entry #2", key: "entry_2" },
                      { label: "Entry #30", key: "entry_30" },
                      { label: "Most eliminations", key: "most_eliminations" },
                    ].map((field) => (
                      <label
                        key={field.key}
                        className="flex flex-col text-sm text-zinc-300"
                      >
                        {field.label}
                        <select
                          className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                          value={(payload as Record<string, string | null>)[
                            field.key
                          ] ?? ""}
                          onChange={(event) =>
                            setPayload((prev) => ({
                              ...prev,
                              [field.key]: event.target.value || null,
                            }))
                          }
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
                        disabled={saving}
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
                  disabled={saving}
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
      </main>
    </div>
  );
}
