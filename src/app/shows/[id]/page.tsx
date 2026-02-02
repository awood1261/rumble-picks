"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import type { ShowRow } from "../../../lib/picksTypes";

export default function ShowDetailPage() {
  const params = useParams();
  const showId = typeof params?.id === "string" ? params.id : "";
  const [show, setShow] = useState<ShowRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    if (!showId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("shows")
        .select("id, name, image_url, starts_at, status")
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
            Back to shows
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        {message && (
          <div className="rounded-2xl border border-zinc-800 bg-black/50 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        )}

        {!show ? (
          <p className="text-sm text-zinc-400">Loading show...</p>
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8">
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Show
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-amber-100">
                {show.name}
              </h1>
              <p className="mt-3 text-sm text-zinc-400">
                Choose your picks or view the latest scores.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/picks?show=${show.id}`}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-amber-400 px-6 text-xs font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
                >
                  Make picks
                </Link>
                <Link
                  href={`/scoreboard?show=${show.id}`}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-amber-400/60 px-6 text-xs font-semibold uppercase tracking-wide text-amber-200 transition hover:border-amber-300 hover:text-amber-100"
                >
                  View scores
                </Link>
              </div>
            </div>
            {show.image_url ? (
              <img
                src={show.image_url}
                alt={show.name}
                className="absolute inset-0 h-full w-full object-cover opacity-35"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/60 via-zinc-950 to-black" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/50 to-transparent" />
          </div>
        )}

        <div className="mt-8">
          <Link
            className="inline-flex rounded-full border border-zinc-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            href="/shows"
          >
            Back to shows
          </Link>
        </div>
      </main>
    </div>
  );
}
