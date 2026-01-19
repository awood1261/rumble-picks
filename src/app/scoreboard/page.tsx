"use client";

import { useEffect, useMemo, useState } from "react";
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

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type ScoreboardRow = ScoreRow & { display_name: string };

export default function ScoreboardPage() {
  const searchParams = useSearchParams();
  const queryEventId = searchParams.get("event");
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

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

  const topThree = useMemo(() => filteredScoreboard.slice(0, 3), [filteredScoreboard]);
  const currentUserIndex = useMemo(() => {
    if (!currentUserId) return null;
    const idx = filteredScoreboard.findIndex(
      (row) => row.user_id === currentUserId
    );
    return idx >= 0 ? idx : null;
  }, [currentUserId, filteredScoreboard]);

  const loadScores = async () => {
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
  };

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

    const channel = supabase
      .channel("scoreboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores" },
        () => {
          loadScores();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEventId]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Live Scoreboard
          </p>
          <h1 className="text-3xl font-semibold">Rumble Picks Leaderboard</h1>
          <p className="text-sm text-zinc-400">
            Scores update as eliminations and results are recorded.
          </p>
        </header>

        {message && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/50 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        )}

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          {events.length > 1 && (
            <div className="mb-6">
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
                      <span className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                        #{index + 1}
                      </span>
                      {index === 0 && (
                        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
                          <svg
                            className="h-4 w-4"
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
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
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
