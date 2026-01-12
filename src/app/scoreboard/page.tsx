"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type ScoreRow = {
  id: string;
  user_id: string;
  points: number;
  breakdown: Record<string, number> | null;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type ScoreboardRow = ScoreRow & { display_name: string };

export default function ScoreboardPage() {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
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
      .select("id, user_id, points, breakdown, updated_at");
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
  }, []);

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
          {loading ? (
            <p className="text-sm text-zinc-400">Loading scoreboard…</p>
          ) : scoreboard.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No scores yet. Once picks are in, they will appear here.
            </p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {scoreboard.map((row, index) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold text-amber-300">
                      #{index + 1}
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
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold">{row.points}</p>
                    <p className="text-xs text-zinc-500">points</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
