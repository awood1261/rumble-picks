"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { ScoreboardCountdown } from "../../components/ScoreboardCountdown";

type ScoreRow = {
  id: string;
  user_id: string;
  show_id: string | null;
  points: number;
  breakdown: Record<string, number> | null;
  updated_at: string;
};

type ShowRow = {
  id: string;
  name: string;
};

type EventRow = {
  id: string;
  name: string;
  show_id: string | null;
  rumble_gender: string | null;
};

type RumbleEntryRow = {
  event_id: string;
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

const SCOREBOARD_POLL_INTERVAL_MS = 60000;

export default function ScoreboardPage() {
  const searchParams = useSearchParams();
  const queryShowId = searchParams.get("show");
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedShowId, setSelectedShowId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rumbleEntries, setRumbleEntries] = useState<RumbleEntryRow[]>([]);
  const [eventEntrants, setEventEntrants] = useState<EventEntrantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [rankDelta, setRankDelta] = useState<Record<string, number | null>>({});
  const previousRanksRef = useRef<Record<string, number>>({});
  const lastDeltaRef = useRef<Record<string, number>>({});
  const [lastUpdateAt, setLastUpdateAt] = useState(Date.now());

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

  const showEvents = useMemo(
    () => events.filter((event) => event.show_id === selectedShowId),
    [events, selectedShowId]
  );

  const filteredScoreboard = useMemo(() => {
    if (!selectedShowId) return scoreboard;
    return scoreboard.filter((row) => row.show_id === selectedShowId);
  }, [scoreboard, selectedShowId]);

  const topThree = useMemo(() => filteredScoreboard.slice(0, 3), [filteredScoreboard]);
  const currentUserIndex = useMemo(() => {
    if (!currentUserId) return null;
    const idx = filteredScoreboard.findIndex(
      (row) => row.user_id === currentUserId
    );
    return idx >= 0 ? idx : null;
  }, [currentUserId, filteredScoreboard]);

  const winnerEntrantsByEvent = useMemo(() => {
    const winners: Record<string, string | null> = {};
    showEvents.forEach((event) => {
      const entries = rumbleEntries.filter((entry) => entry.event_id === event.id);
      if (entries.length < 30) {
        winners[event.id] = null;
        return;
      }
      const remaining = entries.filter((entry) => !entry.eliminated_at);
      winners[event.id] = remaining.length === 1 ? remaining[0].entrant_id : null;
    });
    return winners;
  }, [rumbleEntries, showEvents]);

  const entrantMap = useMemo(() => {
    return new Map(eventEntrants.map((entrant) => [entrant.id, entrant]));
  }, [eventEntrants]);

  const entryNumberMap = useMemo(() => {
    return new Map(
      rumbleEntries.map((entry) => [entry.entrant_id, entry.entry_number])
    );
  }, [rumbleEntries]);

  const entriesByEvent = useMemo(() => {
    const byEvent: Record<string, RumbleEntryRow[]> = {};
    showEvents.forEach((event) => {
      byEvent[event.id] = rumbleEntries.filter(
        (entry) => entry.event_id === event.id
      );
    });
    return byEvent;
  }, [rumbleEntries, showEvents]);

  const remainingEntrantsByEvent = useMemo(() => {
    const map: Record<string, EventEntrantRow[]> = {};
    Object.entries(entriesByEvent).forEach(([eventId, entries]) => {
      const remainingIds = new Set(
        entries.filter((entry) => !entry.eliminated_at).map((entry) => entry.entrant_id)
      );
      map[eventId] = eventEntrants.filter((entrant) => remainingIds.has(entrant.id));
    });
    return map;
  }, [entriesByEvent, eventEntrants]);

  const eliminatedEntrantIdsByEvent = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    Object.entries(entriesByEvent).forEach(([eventId, entries]) => {
      map[eventId] = new Set(
        entries.filter((entry) => entry.eliminated_at).map((entry) => entry.entrant_id)
      );
    });
    return map;
  }, [entriesByEvent]);

  const loadScores = useCallback(async () => {
    setMessage(null);
    const { data: scoreRows, error: scoreError } = await supabase
      .from("scores")
      .select("id, user_id, show_id, points, breakdown, updated_at");
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
    if (selectedShowId) {
      const eventScores = (scoreRows ?? [])
        .filter((row) => row.show_id === selectedShowId)
        .sort((a, b) => b.points - a.points);
      const nextRankMap: Record<string, number> = {};
      eventScores.forEach((row, index) => {
        nextRankMap[row.user_id] = index + 1;
      });
      const updated: Record<string, number | null> = { ...lastDeltaRef.current };
      eventScores.forEach((row) => {
        const prevRank = previousRanksRef.current[row.user_id];
        if (typeof prevRank === "number") {
          const delta = prevRank - nextRankMap[row.user_id];
          if (delta !== 0) {
            updated[row.user_id] = delta;
          }
        } else if (!(row.user_id in updated)) {
          updated[row.user_id] = null;
        }
      });
      setRankDelta(updated);
      previousRanksRef.current = nextRankMap;
      lastDeltaRef.current = Object.fromEntries(
        Object.entries(updated).filter(([, value]) => value !== null)
      ) as Record<string, number>;
    } else {
      setRankDelta({});
      previousRanksRef.current = {};
      lastDeltaRef.current = {};
    }

    setScores(scoreRows ?? []);
    setProfiles(profileRows ?? []);
    setLoading(false);
    setLastUpdateAt(Date.now());
  }, [selectedShowId]);

  const loadRumbleEntries = useCallback(async () => {
    if (!selectedShowId || showEvents.length === 0) {
      setRumbleEntries([]);
      setEventEntrants([]);
      return;
    }
    const eventIds = showEvents.map((event) => event.id);
      const { data: entryRows, error } = await supabase
      .from("rumble_entries")
      .select("event_id, entrant_id, entry_number, eliminated_at")
      .in("event_id", eventIds);
    if (error) {
      setMessage(error.message);
      return;
    }
    setRumbleEntries((entryRows ?? []) as RumbleEntryRow[]);

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
    setLastUpdateAt(Date.now());
  }, [selectedShowId, showEvents]);

  useEffect(() => {
    if (queryShowId && shows.some((show) => show.id === queryShowId)) {
      setSelectedShowId(queryShowId);
    }
  }, [queryShowId, shows]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id ?? null);
    });

    const loadShows = async () => {
      const { data: showRows, error: showError } = await supabase
        .from("shows")
        .select("id, name")
        .order("starts_at", { ascending: true });
      if (showError) {
        setMessage(showError.message);
        return;
      }
      setShows(showRows ?? []);
      if (showRows && showRows.length > 0) {
        const defaultId =
          queryShowId && showRows.some((show) => show.id === queryShowId)
            ? queryShowId
            : showRows[0].id;
        setSelectedShowId((current) => current || defaultId);
      }
    };

    const loadEvents = async () => {
      const { data: eventRows, error } = await supabase
        .from("events")
        .select("id, name, show_id, rumble_gender")
        .order("starts_at", { ascending: true });
      if (error) {
        setMessage(error.message);
        return;
      }
      setEvents(eventRows ?? []);
    };

    loadShows();
    loadEvents();
    loadScores();
  }, [loadScores, queryShowId]);

  useEffect(() => {
    previousRanksRef.current = {};
    setRankDelta({});
    lastDeltaRef.current = {};
  }, [selectedShowId]);

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
      <ScoreboardCountdown
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4px)] left-0 right-0 z-40 px-6 sm:bottom-[calc(env(safe-area-inset-bottom,0px)+6px)]"
        intervalMs={SCOREBOARD_POLL_INTERVAL_MS}
        lastUpdateAt={lastUpdateAt}
      />
      <main className="mx-auto w-full max-w-5xl pb-10 pt-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Scoreboard</h1>
          <p className="text-sm text-zinc-400">
            Scores update as eliminations and results are recorded.
          </p>
        </header>
        {shows.length > 1 && (
          <div className="mt-6">
            <label className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Show
              <select
                className="mt-2 h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                value={selectedShowId}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedShowId(value);
                  const url = new URL(window.location.href);
                  url.searchParams.set("show", value);
                  window.history.replaceState({}, "", url.toString());
                }}
              >
                {shows.map((show) => (
                  <option key={show.id} value={show.id}>
                    {show.name}
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
          <div className="mb-6 space-y-4">
            {showEvents.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-xs text-zinc-400">
                No rumble events added yet.
              </div>
            ) : (
              showEvents.map((event) => {
                const eventEntries = entriesByEvent[event.id] ?? [];
                const eliminatedSet = eliminatedEntrantIdsByEvent[event.id] ?? new Set();
                const remainingEntrants = remainingEntrantsByEvent[event.id] ?? [];
                const winnerEntrantId = winnerEntrantsByEvent[event.id];
                const entrantsForEvent = eventEntrants.filter((entrant) =>
                  eventEntries.some((entry) => entry.entrant_id === entrant.id)
                );
                return (
                  <div
                    key={event.id}
                    className="grid gap-4 lg:grid-cols-2"
                  >
                    <details className="group rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-[11px]">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
                        {event.name} entrants
                        <span className="text-zinc-600 transition group-open:rotate-180">
                          ▾
                        </span>
                      </summary>
                      {entrantsForEvent.length === 0 ? (
                        <p className="mt-3 text-zinc-400">No entrants added yet.</p>
                      ) : (
                        <ul className="mt-3 max-h-28 space-y-2 overflow-y-auto pr-1 text-zinc-300">
                          {[...entrantsForEvent]
                            .sort((a, b) => {
                              const aNum = entryNumberMap.get(a.id);
                              const bNum = entryNumberMap.get(b.id);
                              if (aNum == null && bNum == null) return a.name.localeCompare(b.name);
                              if (aNum == null) return 1;
                              if (bNum == null) return -1;
                              return aNum - bNum;
                            })
                            .map((entrant) => {
                              const eliminated = eliminatedSet.has(entrant.id);
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
                    </details>
                    <details className="group rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 text-[11px]">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
                        {event.name} remaining
                        <span className="text-zinc-600 transition group-open:rotate-180">
                          ▾
                        </span>
                      </summary>
                      {remainingEntrants.length === 0 ? (
                        <p className="mt-3 text-zinc-400">
                          {winnerEntrantId
                            ? "Winner determined."
                            : "All entrants eliminated."}
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
                    </details>
                  </div>
                );
              })
            )}
          </div>
          {currentUserIndex !== null && (
            <div className="mb-6 rounded-2xl border border-sky-400/40 bg-sky-400/5 px-4 py-3 text-sm text-sky-100">
              You are currently <span className="font-semibold">#{currentUserIndex + 1}</span> in this show.
            </div>
          )}
          {loading ? (
            <p className="text-sm text-zinc-400">Loading scoreboard…</p>
          ) : filteredScoreboard.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-6 text-sm text-zinc-300">
              <p>No picks yet for this show.</p>
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
                {topThree.map((row, index) => {
                  const delta = rankDelta[row.user_id];
                  return (
                  <Link
                    key={row.id}
                    className={`rounded-2xl border px-4 py-4 transition hover:text-amber-200 ${
                      index === 0
                        ? "border-amber-400/60 bg-amber-400/10"
                        : "border-zinc-800 bg-zinc-950/50"
                    }`}
                    href={`/scoreboard/${row.user_id}?show=${row.show_id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-3xl font-semibold text-amber-300">
                        #{index + 1}
                        {typeof delta === "number" && delta !== 0 && (
                          <span
                            className={`text-xs font-semibold uppercase tracking-wide ${
                              delta > 0
                                ? "text-emerald-300"
                                : "text-rose-300"
                            }`}
                          >
                            {delta > 0
                              ? `▲ ${Math.abs(delta)}`
                              : `▼ ${Math.abs(delta)}`}
                          </span>
                        )}
                      </span>
                      {index === 0 &&
                        showEvents.some((event) => winnerEntrantsByEvent[event.id]) && (
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
                );
                })}
              </div>

              <div className="divide-y divide-zinc-800">
                {filteredScoreboard.slice(3).map((row, index) => {
                  const delta = rankDelta[row.user_id];
                  const content = (
                    <>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-2 text-lg font-semibold text-amber-300">
                          #{index + 4}
                          {typeof delta === "number" && delta !== 0 && (
                            <span
                              className={`text-xs font-semibold uppercase tracking-wide ${
                                delta > 0 ? "text-emerald-300" : "text-rose-300"
                              }`}
                            >
                              {delta > 0
                                ? `▲ ${Math.abs(delta)}`
                                : `▼ ${Math.abs(delta)}`}
                            </span>
                          )}
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

                if (!row.show_id) {
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
                    href={`/scoreboard/${row.user_id}?show=${row.show_id}`}
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
