"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import type { PromotionRow, ShowRow } from "../../lib/picksTypes";

const formatShowDate = (startsAt: string | null) => {
  if (!startsAt) return "Show date TBD";
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "Show date TBD";
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const getLockStatusText = (startsAt: string | null, now: number) => {
  if (!startsAt) {
    return "Lock time not set";
  }
  const startTime = new Date(startsAt).getTime();
  const diffMs = startTime - now;
  if (diffMs <= 0) {
    return "Show is locked";
  }
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  const parts = [
    days ? `${days}d` : null,
    hours ? `${pad(hours)}h` : null,
    minutes ? `${pad(minutes)}m` : null,
    `${pad(seconds)}s`,
  ].filter(Boolean);
  return `Picks lock in ${parts.join(" ")}`;
};

export default function PlayPage() {
  const router = useRouter();
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const promotionById = useMemo(() => {
    return new Map(promotions.map((promotion) => [promotion.id, promotion]));
  }, [promotions]);

  const activeShows = useMemo(() => {
    return shows.filter((show) => {
      if (!show.starts_at) return false;
      const startTime = new Date(show.starts_at).getTime();
      if (Number.isNaN(startTime)) return false;
      return startTime > now;
    });
  }, [shows, now]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      const [{ data: showRows, error: showError }, { data: promotionRows }] =
        await Promise.all([
          supabase
            .from("shows")
            .select("id, name, image_url, promotion_id, status, starts_at")
            .order("starts_at", { ascending: true }),
          supabase
            .from("promotions")
            .select("id, name, image_url")
            .order("name", { ascending: true }),
        ]);
      if (ignore) return;
      if (showError) {
        setMessage(showError.message);
        setShows([]);
        setPromotions(promotionRows ?? []);
      } else {
        setMessage(null);
        setShows((showRows ?? []) as ShowRow[]);
        setPromotions((promotionRows ?? []) as PromotionRow[]);
      }
      setLoading(false);
    };
    load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (activeShows.length === 1) {
      const target = activeShows[0];
      if (target?.promotion_id) {
        router.replace(`/shows/${target.promotion_id}/${target.id}`);
      } else {
        router.replace("/shows");
      }
    }
  }, [activeShows, loading, router]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-8">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
            Now Playing
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-zinc-100 sm:text-4xl">
            Choose your show
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Scan in and jump right into picks for today’s active events.
          </p>
        </header>

        {message && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-black/60 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="h-60 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/70"
              />
            ))}
          </div>
        ) : activeShows.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-300">
            No active shows are available right now.
          </div>
        ) : activeShows.length > 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeShows.map((show) => {
              const promotion = show.promotion_id
                ? promotionById.get(show.promotion_id)
                : null;
              const lockStatusText = getLockStatusText(show.starts_at, now);
              return (
                <Link
                  key={show.id}
                  href={
                    show.promotion_id
                      ? `/shows/${show.promotion_id}/${show.id}`
                      : "/shows"
                  }
                  className="group relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70"
                >
                  {show.image_url ? (
                    <img
                      src={show.image_url}
                      alt={show.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />
                  <div className="relative flex h-full flex-col justify-between gap-4 p-5">
                    <div className="flex items-center gap-3">
                      {promotion?.image_url ? (
                        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-amber-400/40 bg-black/50">
                          <img
                            src={promotion.image_url}
                            alt={promotion.name ?? "Promotion"}
                            className="h-full w-full object-cover"
                          />
                        </span>
                      ) : null}
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
                          {formatShowDate(show.starts_at)}
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold text-zinc-100">
                          {show.name}
                        </h2>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-200">
                      <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1">
                        <span className="text-amber-200">🔒</span>
                        {lockStatusText}
                      </span>
                      <span className="text-amber-200 transition group-hover:text-amber-100">
                        Enter →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : null}
      </main>
    </div>
  );
}
