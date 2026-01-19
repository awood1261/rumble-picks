"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
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
    const filteredScores = selectedEventId
      ? (scoreRows ?? []).filter((row) => row.event_id === selectedEventId)
      : scoreRows ?? [];

    const userIds = Array.from(
      new Set(filteredScores.map((row) => row.user_id))
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
    setScores(filteredScores);
    setProfiles(profileRows ?? []);
    setLoading(false);
  };

  useEffect(() => {
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
      if (!selectedEventId && eventRows && eventRows.length > 0) {
        setSelectedEventId(eventRows[0].id);
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
                  onChange={(event) => setSelectedEventId(event.target.value)}
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
          {loading ? (
            <p className="text-sm text-zinc-400">Loading scoreboard…</p>
          ) : scoreboard.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No scores yet. Once picks are in, they will appear here.
            </p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {scoreboard.map((row, index) => {
                const content = (
                  <>
                    <div className="flex items-center gap-4">
                      <span
                        className={
                          index === 0
                            ? "text-2xl font-semibold text-amber-300"
                            : "text-lg font-semibold text-amber-300"
                        }
                      >
                        #{index + 1}
                      </span>
                      <div>
                        <p
                          className={
                            index === 0
                              ? "text-lg font-semibold"
                              : "text-base font-semibold"
                          }
                        >
                          {row.display_name}
                        </p>
                        <p className="text-xs text-zinc-400">
                          Updated{" "}
                          {new Date(row.updated_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
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
                  index === 0
                    ? "-mx-6 px-6 bg-amber-400/10 border border-amber-400/60 shadow-[0_0_24px_rgba(251,191,36,0.18)]"
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
          )}
        </section>
      </main>
    </div>
  );
}
