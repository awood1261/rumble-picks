"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import type { PromotionRow, ShowRow } from "../../../../lib/picksTypes";

export default function ShowDetailPage() {
  const params = useParams();
  const showId = typeof params?.showId === "string" ? params.showId : "";
  const promotionId =
    typeof params?.promotionId === "string" ? params.promotionId : "";
  const [show, setShow] = useState<ShowRow | null>(null);
  const [promotion, setPromotion] = useState<PromotionRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const formattedStart = useMemo(() => {
    if (!show?.starts_at) return null;
    const date = new Date(show.starts_at);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [show?.starts_at]);

  useEffect(() => {
    let ignore = false;
    if (!showId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("id, name, tagline, image_url, starts_at, status, promotion_id")
        .eq("id", showId)
        .maybeSingle();
      if (ignore) return;
      if (error) {
        setMessage(error.message);
      } else {
        setShow(data ?? null);
      }
      if (data?.promotion_id) {
        const { data: promotionRow, error: promotionError } = await supabase
          .from("promotions")
          .select("id, name, image_url")
          .eq("id", data.promotion_id)
          .maybeSingle();
        if (ignore) return;
        if (promotionError) {
          setMessage(promotionError.message);
        } else {
          setPromotion(promotionRow ?? null);
        }
      } else {
        setPromotion(null);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [showId]);

  useEffect(() => {
    let ignore = false;
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (ignore) return;
      if (!error && data?.user) {
        setIsSignedIn(true);
      } else {
        setIsSignedIn(false);
      }
      setAuthChecked(true);
    };
    loadUser();
    return () => {
      ignore = true;
    };
  }, []);

  if (!showId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 py-10">
          <div className="mb-6">
            <Link
              className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200 hover:text-amber-100"
              href={promotionId ? `/shows/${promotionId}` : "/shows"}
            >
              ← Back to shows
            </Link>
          </div>
          <p className="text-sm text-zinc-400">Missing show id.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-zinc-100">
      {show?.image_url ? (
        <img
          src={show.image_url}
          alt={show.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/55 to-black/90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,196,0,0.22),_transparent_55%)]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 pb-12 pt-6">
        {message && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-black/50 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        )}

        {!show ? (
          <p className="text-sm text-zinc-400">Loading show...</p>
        ) : (
          <div className="max-w-2xl">
            <div className="flex items-center gap-4">
              {promotion?.image_url ? (
                <div className="h-12 w-12 overflow-hidden rounded-full border border-amber-400/40 bg-black/40">
                  <img
                    src={promotion.image_url}
                    alt={promotion?.name ?? show.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
                  {formattedStart ?? "Show date TBD"}
                </p>
                <h1 className="mt-3 text-4xl font-semibold text-amber-100 sm:text-5xl">
                  {show.name}
                </h1>
              </div>
            </div>
            {show.tagline ? (
              <p className="mt-4 text-sm text-amber-100 sm:text-base">
                {show.tagline}
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              {isSignedIn ? (
                <Link
                  href={`/picks?show=${show.id}`}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-amber-400 px-6 text-xs font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
                >
                  Make picks
                </Link>
              ) : null}
              <Link
                href={`/scoreboard?show=${show.id}`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-amber-400/70 px-6 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300 hover:text-amber-50"
              >
                View scores
              </Link>
            </div>
            {authChecked && !isSignedIn ? (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-zinc-200">
                  Sign in to lock your picks for this show.
                </p>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-white/10 px-5 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:bg-white/20"
                >
                  Sign in to make picks
                </Link>
              </div>
            ) : null}
          </div>
        )}

      </main>
    </div>
  );
}
