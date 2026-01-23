"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type ScoreRow = {
  id: string;
  user_id: string;
  event_id: string | null;
  points: number;
  breakdown: Record<string, number> | null;
  updated_at: string;
};

type EventRow = {
  id: string;
  name: string;
};

type RumbleEntryRow = {
  entrant_id: string;
  entry_number: number | null;
  eliminated_at: string | null;
};

type EventEntrantRow = {
  id: string;
  name: string;
  promotion: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type ScoreboardRow = ScoreRow & { display_name: string };

const SCOREBOARD_POLL_INTERVAL_MS = 15000;

export default function ScoreboardPage() {
  const searchParams = useSearchParams();
  const queryEventId = searchParams.get("event");
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rumbleEntries, setRumbleEntries] = useState<RumbleEntryRow[]>([]);
  const [eventEntrants, setEventEntrants] = useState<EventEntrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [rankDelta, setRankDelta] = useState<Record<string, number | null>>({});
  const previousRanksRef = useRef<Record<string, number>>({});

  const scoreboard = useMemo(() => {
    const profileMap = new Map(
      profiles.map((profile) => [
        profile.id,
        profile.display_name ?? "Anonymous",
      ])
    );
    return scores
      .map((score) => ({
        ...score,
        display_name: profileMap.get(score.user_id) ?? "Anonymous",
      }))
      .sort((a, b) => b.points - a.points);
  }, [scores, profiles]);

  const filteredScoreboard = useMemo(() => {
    if (!selectedEventId) return scoreboard;
    return scoreboard.filter((row) => row.event_id === selectedEventId);
  }, [scoreboard, selectedEventId]);

  useEffect(() => {
    const nextRankMap: Record<string, number> = {};
    filteredScoreboard.forEach((row, index) => {
      nextRankMap[row.user_id] = index + 1;
    });

    setRankDelta((prev) => {
      const updated: Record<string, number | null> = { ...prev };
      filteredScoreboard.forEach((row) => {
        const prevRank = previousRanksRef.current[row.user_id];
        if (prevRank) {
          updated[row.user_id] = prevRank - nextRankMap[row.user_id];
        } else {
          updated[row.user_id] = null;
        }
      });
      return updated;
    });

    previousRanksRef.current = nextRankMap;
  }, [filteredScoreboard]);

  const topThree = useMemo(() => filteredScoreboard.slice(0, 3), [filteredScoreboard]);
  const currentUserIndex = useMemo(() => {
    if (!currentUserId) return null;
    const idx = filteredScoreboard.findIndex(
      (row) => row.user_id === currentUserId
    );
    return idx >= 0 ? idx : null;
  }, [currentUserId, filteredScoreboard]);

  const winnerEntrantId = useMemo(() => {
    if (rumbleEntries.length < 30) return null;
    const remaining = rumbleEntries.filter((entry) => !entry.eliminated_at);
    return remaining.length === 1 ? remaining[0].entrant_id : null;
  }, [rumbleEntries]);

  const entrantMap = useMemo(() => {
    return new Map(eventEntrants.map((entrant) => [entrant.id, entrant]));
  }, [eventEntrants]);

  const entryNumberMap = useMemo(() => {
    return new Map(
      rumbleEntries.map((entry) => [entry.entrant_id, entry.entry_number])
    );
  }, [rumbleEntries]);

  const remainingEntrants = useMemo(() => {
    const remainingIds = new Set(
      rumbleEntries
        .filter((entry) => !entry.eliminated_at)
        .map((entry) => entry.entrant_id)
    );
    return eventEntrants.filter((entrant) => remainingIds.has(entrant.id));
  }, [eventEntrants, rumbleEntries]);

  const eliminatedEntrantIds = useMemo(() => {
    return new Set(
      rumbleEntries
        .filter((entry) => entry.eliminated_at)
        .map((entry) => entry.entrant_id)
    );
  }, [rumbleEntries]);

  const loadScores = useCallback(async () => {
    setMessage(null);
    const { data: scoreRows, error: scoreError } = await supabase
      .from("scores")
      .select("id, user_id, event_id, points, breakdown, updated_at");
    if (scoreError) {
      setMessage(scoreError.message);
      setLoading(false);
      return;
    }
    const userIds = Array.from(
      new Set((scoreRows ?? []).map((row) => row.user_id))
    );
    if (userIds.length === 0) {
      setScores(scoreRows ?? []);
      setProfiles([]);
      setLoading(false);
      return;
    }
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    if (profileError) {
      setMessage(profileError.message);
    }
    setScores(scoreRows ?? []);
    setProfiles(profileRows ?? []);
    setLoading(false);
  }, []);

  const loadRumbleEntries = useCallback(async () => {
    if (!selectedEventId) {
      setRumbleEntries([]);
      setEventEntrants([]);
      return;
    }
    const { data: entryRows, error } = await supabase
      .from("rumble_entries")
      .select("entrant_id, entry_number, eliminated_at")
      .eq("event_id", selectedEventId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setRumbleEntries(entryRows ?? []);

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
    setEventEntrants(entrantRows ?? []);
  }, [selectedEventId]);

  useEffect(() => {
    if (queryEventId && events.some((event) => event.id === queryEventId)) {
      setSelectedEventId(queryEventId);
    }
  }, [queryEventId, events]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id ?? null);
    });

    const loadEvents = async () => {
      const { data: eventRows, error } = await supabase
        .from("events")
        .select("id, name")
        .order("starts_at", { ascending: true });
      if (error) {
        setMessage(error.message);
        return;
      }
      setEvents(eventRows ?? []);
      if (eventRows && eventRows.length > 0) {
        const defaultId =
          queryEventId && eventRows.some((event) => event.id === queryEventId)
            ? queryEventId
            : eventRows[0].id;
        setSelectedEventId((current) => current || defaultId);
      }
    };

    loadEvents();
    loadScores();
  }, [loadScores, queryEventId]);

  useEffect(() => {
    loadRumbleEntries();
    loadScores();

    const interval = setInterval(() => {
      loadScores();
      loadRumbleEntries();
    }, SCOREBOARD_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadRumbleEntries, loadScores]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Scoreboard</h1>
          <p className="text-sm text-zinc-400">
            Scores update as eliminations and results are recorded.
          </p>
        </header>
        {events.length > 1 && (
          <div className="mt-6">
            <label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Event
              <select
                className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                value={selectedEventId}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedEventId(value);
                  const url = new URL(window.location.href);
                  url.searchParams.set("event", value);
                  window.history.replaceState({}, "", url.toString());
                }}
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
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
          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-xs">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
                Entrants in Rumble
              </p>
              {eventEntrants.length === 0 ? (
                <p className="mt-3 text-zinc-400">No entrants added yet.</p>
              ) : (
                <ul className="mt-3 max-h-28 space-y-2 overflow-y-auto pr-1 text-zinc-300">
                  {[...eventEntrants]
                    .sort((a, b) => {
                      const aNum = entryNumberMap.get(a.id);
                      const bNum = entryNumberMap.get(b.id);
                      if (aNum == null && bNum == null) return a.name.localeCompare(b.name);
                      if (aNum == null) return 1;
                      if (bNum == null) return -1;
                      return aNum - bNum;
                    })
                    .map((entrant) => {
                    const eliminated = eliminatedEntrantIds.has(entrant.id);
                    return (
                      <li
                        key={entrant.id}
                        className="flex items-center justify-between gap-2"
                      >
                        <span
                          className={
                            eliminated ? "text-red-200" : "text-zinc-300"
                          }
                        >
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
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-xs">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
                Not Eliminated
              </p>
              {remainingEntrants.length === 0 ? (
                <p className="mt-3 text-zinc-400">
                  All entrants eliminated (winner determined).
                </p>
              ) : (
                <ul className="mt-3 max-h-28 space-y-2 overflow-y-auto pr-1 text-zinc-300">
                  {remainingEntrants.map((entrant) => (
                    <li key={entrant.id}>
                      {entrant.name}
                      {entrant.promotion ? ` • ${entrant.promotion}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {currentUserIndex !== null && (
            <div className="mb-6 rounded-2xl border border-sky-400/40 bg-sky-400/5 px-4 py-3 text-sm text-sky-100">
              You are currently <span className="font-semibold">#{currentUserIndex + 1}</span> in this event.
            </div>
          )}
          {loading ? (
            <p className="text-sm text-zinc-400">Loading scoreboard…</p>
          ) : filteredScoreboard.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-6 text-sm text-zinc-300">
              <p>No picks yet for this event.</p>
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
                {topThree.map((row, index) => (
                  <Link
                    key={row.id}
                    className={`rounded-2xl border px-4 py-4 transition hover:text-amber-200 ${
                      index === 0
                        ? "border-amber-400/60 bg-amber-400/10"
                        : "border-zinc-800 bg-zinc-950/50"
                    }`}
                    href={`/scoreboard/${row.user_id}?event=${row.event_id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-semibold text-amber-300">
                        #{index + 1}
                      </span>
                      {rankDelta[row.user_id] !== null && rankDelta[row.user_id] !== 0 && (
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            (rankDelta[row.user_id] ?? 0) > 0
                              ? "text-emerald-300"
                              : "text-rose-300"
                          }`}
                        >
                          {(rankDelta[row.user_id] ?? 0) > 0
                            ? `▲ ${Math.abs(rankDelta[row.user_id] ?? 0)}`
                            : `▼ ${Math.abs(rankDelta[row.user_id] ?? 0)}`}
                        </span>
                      )}
                      {index === 0 && winnerEntrantId && (
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
                    <p className="mt-3 text-lg font-semibold">{row.display_name}</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {row.points} points
                    </p>
                  </Link>
                ))}
              </div>

              <div className="divide-y divide-zinc-800">
                {filteredScoreboard.slice(3).map((row, index) => {
                  const delta = rankDelta[row.user_id];
                  const content = (
                    <>
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-semibold text-amber-300">
                          #{index + 4}
                        </span>
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
                        {currentUserId === row.user_id && (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                            You
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {delta !== null && delta !== 0 && (
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            delta > 0 ? "text-emerald-300" : "text-rose-300"
                          }`}
                        >
                          {delta > 0 ? `▲ ${Math.abs(delta)}` : `▼ ${Math.abs(delta)}`}
                        </p>
                      )}
                      <p className="text-2xl font-semibold">{row.points}</p>
                      <p className="text-xs text-zinc-500">points</p>
                    </div>
                  </>
                );

                const rowClassName = `flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between ${
                  index % 2 === 0 ? "bg-zinc-950/40" : "bg-zinc-900/30"
                } ${
                  currentUserId === row.user_id
                    ? "border border-sky-400/50 bg-sky-400/5"
                    : ""
                }`;

                if (!row.event_id) {
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
                    className={`${rowClassName} transition hover:text-amber-200`}
                    href={`/scoreboard/${row.user_id}?event=${row.event_id}`}
                  >
                    {content}
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
