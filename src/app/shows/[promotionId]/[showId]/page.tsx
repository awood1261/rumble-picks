"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import type { ShowRow } from "../../../../lib/picksTypes";

export default function ShowDetailPage() {
  const params = useParams();
  const showId = typeof params?.showId === "string" ? params.showId : "";
  const promotionId =
    typeof params?.promotionId === "string" ? params.promotionId : "";
  const [show, setShow] = useState<ShowRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    if (!showId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("id, name, image_url, starts_at, status, promotion_id")
        .eq("id", showId)
        .maybeSingle();
      if (ignore) return;
      if (error) {
        setMessage(error.message);
      } else {
        setShow(data ?? null);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [showId]);

  if (!showId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 py-10">
          <p className="text-sm text-zinc-400">Missing show id.</p>
          <Link
            className="mt-4 inline-flex rounded-full border border-amber-400/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
            href="/shows"
          >
            Back to promotions
          </Link>
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
      <main className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
        {message && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-black/50 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        )}

        {!show ? (
          <p className="text-sm text-zinc-400">Loading show...</p>
        ) : (
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
              Tonight’s card
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-amber-100 sm:text-5xl">
              {show.name}
            </h1>
            <p className="mt-4 text-sm text-zinc-200 sm:text-base">
              Lock in your picks before bell time and compare with other fans.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/picks?show=${show.id}`}
                className="inline-flex h-12 items-center justify-center rounded-full bg-amber-400 px-6 text-xs font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
              >
                Make picks
              </Link>
              <Link
                href={`/scoreboard?show=${show.id}`}
                className="inline-flex h-12 items-center justify-center rounded-full border border-amber-400/70 px-6 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-300 hover:text-amber-50"
              >
                View scores
              </Link>
            </div>
          </div>
        )}

        <div className="mt-10">
          <Link
            className="inline-flex rounded-full border border-zinc-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            href={promotionId ? `/shows/${promotionId}` : "/shows"}
          >
            Back to shows
          </Link>
        </div>
      </main>
    </div>
  );
}
