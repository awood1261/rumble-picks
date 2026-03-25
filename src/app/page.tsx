"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import posthog from "posthog-js";
import { AdminConsoleLink } from "../components/AdminConsoleLink";
import { ShowCardsGrid } from "../components/ShowCardsGrid";
import { supabase } from "../lib/supabaseClient";
import type { PromotionRow, ShowRow } from "../lib/picksTypes";

export default function Home() {
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [loadingShows, setLoadingShows] = useState(true);
  const [showsMessage, setShowsMessage] = useState<string | null>(null);
  const [hasPlayerIdentity, setHasPlayerIdentity] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const upcomingShows = useMemo(() => {
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
      setLoadingShows(true);
      const [{ data: showRows, error: showError }, { data: promotionRows }] =
        await Promise.all([
          supabase
            .from("shows")
            .select("id, name, image_url, promotion_id, status, starts_at, lock_picks_at_start")
            .order("starts_at", { ascending: true }),
          supabase
            .from("promotions")
            .select("id, name, image_url")
            .order("name", { ascending: true }),
        ]);

      if (ignore) return;

      if (showError) {
        setShows([]);
        setPromotions((promotionRows ?? []) as PromotionRow[]);
        setShowsMessage(showError.message);
      } else {
        setShows((showRows ?? []) as ShowRow[]);
        setPromotions((promotionRows ?? []) as PromotionRow[]);
        setShowsMessage(null);
      }

      setLoadingShows(false);
    };

    load();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    const syncPlayerIdentity = async (userId?: string | null) => {
      const nextUserId =
        userId ??
        (await supabase.auth.getSession()).data.session?.user.id ??
        null;

      if (!nextUserId) {
        if (!ignore) {
          setHasPlayerIdentity(false);
        }
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", nextUserId)
        .maybeSingle();

      if (!ignore) {
        setHasPlayerIdentity(
          Boolean(nextUserId) || Boolean(profile?.display_name?.trim())
        );
      }
    };

    syncPlayerIdentity();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncPlayerIdentity(session?.user.id ?? null);
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex w-full max-w-6xl flex-col px-6 py-6 sm:py-12">
        <section className="flex flex-col items-center justify-center text-center">
          <img
            className="w-52 sm:w-xl"
            src="/images/bp-logo-text-tag.PNG"
            alt="BoutPick. Make Your Call"
          />
          <h1 className="mt-6 text-balance text-4xl font-semibold leading-tight sm:text-5xl">
            Live event picks. Fan-vs-fan bragging rights.
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg text-zinc-300">
            Show up, lock in your picks, and climb the leaderboard. See what other
            diehards chose and prove you know the card best.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            {!hasPlayerIdentity && (
              <Link
                className="inline-flex h-12 items-center justify-center rounded-full bg-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
                href="/login"
                onClick={() =>
                  posthog.capture("homepage_cta_clicked", {
                    cta: "sign_in_to_play",
                    has_player_identity: hasPlayerIdentity,
                  })
                }
              >
                Sign in to play
              </Link>
            )}
            <Link
              className="inline-flex h-12 items-center justify-center rounded-full border border-amber-400 px-6 text-sm font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
              href="/scoreboard"
              onClick={() =>
                posthog.capture("homepage_cta_clicked", {
                  cta: "view_scoreboard",
                  has_player_identity: hasPlayerIdentity,
                })
              }
            >
              View scoreboard
            </Link>
            <Link
              className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-700 px-6 text-sm font-semibold uppercase tracking-wide text-zinc-200 transition hover:border-amber-400 hover:text-amber-200"
              href="/picks"
              onClick={() =>
                posthog.capture("homepage_cta_clicked", {
                  cta: "make_picks",
                  has_player_identity: hasPlayerIdentity,
                })
              }
            >
              Make picks
            </Link>
            {!hasPlayerIdentity && (
              <span className="text-sm text-zinc-400">
                No account? You can sign up in seconds.
              </span>
            )}
          </div>
          <AdminConsoleLink />
        </section>

        <section className="mt-14 w-full">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
              Upcoming Shows
            </p>
          </div>

          {showsMessage ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-300">
              {showsMessage}
            </div>
          ) : loadingShows ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="h-60 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900/70"
                />
              ))}
            </div>
          ) : upcomingShows.length > 0 ? (
            <ShowCardsGrid
              shows={upcomingShows}
              promotions={promotions}
              now={now}
              source="homepage_upcoming_shows"
            />
          ) : (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 text-sm text-zinc-300">
              No upcoming shows are scheduled right now.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
