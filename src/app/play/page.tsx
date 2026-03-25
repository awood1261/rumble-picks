"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { supabase } from "../../lib/supabaseClient";
import type { PromotionRow, ShowRow } from "../../lib/picksTypes";
import { ShowCardsGrid } from "../../components/ShowCardsGrid";

export default function PlayPage() {
  const router = useRouter();
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const featuredShow = useMemo(() => {
    return shows.find((show) => show.is_featured_play_show);
  }, [shows]);

  const activeShows = useMemo(() => {
    return shows.filter((show) => {
      if (show.is_over) return false;
      if (!show.starts_at) return false;
      const startTime = new Date(show.starts_at).getTime();
      if (Number.isNaN(startTime)) return false;
      if (startTime > now) return true;
      return !(show.lock_picks_at_start ?? true);
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
            .select(
              "id, name, image_url, promotion_id, status, starts_at, lock_picks_at_start, is_featured_play_show, is_over"
            )
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
    if (featuredShow) {
      posthog.capture("play_redirected", {
        reason: "featured_show",
        show_id: featuredShow.id,
        show_name: featuredShow.name,
        promotion_id: featuredShow.promotion_id,
      });
      if (featuredShow.promotion_id) {
        router.replace(`/shows/${featuredShow.promotion_id}/${featuredShow.id}`);
      } else {
        router.replace("/shows");
      }
      return;
    }
    if (activeShows.length === 1) {
      const target = activeShows[0];
      posthog.capture("play_redirected", {
        reason: "single_active_show",
        show_id: target.id,
        show_name: target.name,
        promotion_id: target.promotion_id,
      });
      if (target?.promotion_id) {
        router.replace(`/shows/${target.promotion_id}/${target.id}`);
      } else {
        router.replace("/shows");
      }
    }
  }, [activeShows, featuredShow, loading, router]);

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
        ) : featuredShow ? null : activeShows.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-300">
            No active shows are available right now.
          </div>
        ) : activeShows.length > 1 ? (
          <ShowCardsGrid shows={activeShows} promotions={promotions} now={now} source="play" />
        ) : null}
      </main>
    </div>
  );
}
