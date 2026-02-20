"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import type { PromotionRow, ShowRow } from "../../../lib/picksTypes";

export default function PromotionShowsPage() {
  const params = useParams();
  const promotionId =
    typeof params?.promotionId === "string" ? params.promotionId : "";
  const [promotion, setPromotion] = useState<PromotionRow | null>(null);
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const formatShowDate = (value: string | null) => {
    if (!value) return "Show date TBD";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Show date TBD";
    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  useEffect(() => {
    let ignore = false;
    if (!promotionId) return;
    const load = async () => {
      const [{ data: promoRow, error: promoError }, { data: showRows, error }] =
        await Promise.all([
          supabase
            .from("promotions")
            .select("id, name, image_url")
            .eq("id", promotionId)
            .maybeSingle(),
          supabase
            .from("shows")
            .select("id, name, image_url, starts_at, status, promotion_id")
            .eq("promotion_id", promotionId)
            .order("starts_at", { ascending: true }),
        ]);
      if (ignore) return;
      if (promoError) {
        setMessage(promoError.message);
      } else {
        setPromotion(promoRow ?? null);
      }
      if (error) {
        setMessage(error.message);
      } else {
        setShows(showRows ?? []);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [promotionId]);

  if (!promotionId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 py-10">
          <div className="mb-6">
            <Link
              className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200 hover:text-amber-100"
              href="/shows"
            >
              ← Back to promotions
            </Link>
          </div>
          <p className="text-sm text-zinc-400">Missing promotion.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-full max-w-6xl px-6 pb-10 pt-6">
        <div className="mb-6">
          <Link
            className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200 hover:text-amber-100"
            href="/shows"
          >
            ← Back to promotions
          </Link>
        </div>
        {message && (
          <div className="rounded-2xl border border-zinc-800 bg-black/50 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {promotion?.image_url ? (
              <div className="h-14 w-14 overflow-hidden rounded-full border border-amber-400/40 bg-black/40">
                <img
                  src={promotion.image_url}
                  alt={promotion?.name ?? "Promotion"}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : null}
            <div>
              <h1 className="mt-2 text-3xl font-semibold text-amber-100">
                {promotion?.name ?? "Promotion"}
              </h1>
            </div>
          </div>
        </div>

        {shows.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-400">No shows yet.</p>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
            {shows.map((show) => (
              <div key={show.id} className="flex flex-col gap-3">
                <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
                  {formatShowDate(show.starts_at)}
                </p>
                <Link
                  href={`/shows/${promotionId}/${show.id}`}
                  className="group relative aspect-[3/4] overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 transition hover:border-amber-400/60"
                >
                  <div className="relative z-10">
                    <h2 className="mt-2 text-lg font-semibold text-amber-100">
                      {show.name}
                    </h2>
                    <p className="mt-2 text-xs text-zinc-400">
                      Tap to view picks & scores
                    </p>
                  </div>
                  {show.image_url ? (
                    <img
                      src={show.image_url}
                      alt={show.name}
                      className="absolute inset-0 h-full w-full object-cover opacity-30 transition-opacity duration-300 group-hover:opacity-45"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/60 via-zinc-950 to-black" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/40 to-transparent" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
