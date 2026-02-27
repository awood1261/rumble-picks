"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import type { PromotionRow } from "../../lib/picksTypes";

export default function ShowsPage() {
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("id, name, image_url")
        .order("name", { ascending: true });
      if (ignore) return;
      if (error) {
        setMessage(error.message);
      } else {
        setPromotions(data ?? []);
      }
      setLoading(false);
    };
    load();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Promotions</h1>
          <p className="text-sm text-zinc-400">
            Choose a promotion to view its shows.
          </p>
        </header>

        {message && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/50 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-sm text-zinc-400">Loading promotions...</p>
        ) : promotions.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-400">No promotions available.</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-3">
            {promotions.map((promotion) => (
              <Link
                key={promotion.id}
                href={`/shows/${promotion.id}`}
                className="group relative aspect-[3/4] overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 transition hover:border-amber-400/60"
              >
                <div className="relative z-10">
                  <h2 className="mt-2 text-xl font-semibold text-amber-100">
                    {promotion.name}
                  </h2>
                  <p className="mt-3 text-xs text-zinc-400">
                    Tap to view shows
                  </p>
                </div>
                {promotion.image_url ? (
                  <Image
                    src={promotion.image_url}
                    alt={promotion.name}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 50vw"
                    className="absolute inset-0 h-full w-full object-cover opacity-30 transition-opacity duration-300 group-hover:opacity-45"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/60 via-zinc-950 to-black" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/40 to-transparent" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
