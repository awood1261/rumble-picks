"use client";

import Link from "next/link";
import posthog from "posthog-js";
import type { PromotionRow, ShowRow } from "../lib/picksTypes";

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

type ShowCardsGridProps = {
  shows: ShowRow[];
  promotions: PromotionRow[];
  now: number;
  source?: "homepage_upcoming_shows" | "play";
};

export const ShowCardsGrid = ({
  shows,
  promotions,
  now,
  source = "play",
}: ShowCardsGridProps) => {
  const promotionById = new Map(
    promotions.map((promotion) => [promotion.id, promotion])
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {shows.map((show) => {
        const promotion = show.promotion_id
          ? promotionById.get(show.promotion_id)
          : null;
        const lockStatusText = getLockStatusText(show.starts_at, now);
        return (
          <Link
            key={show.id}
            href={
              show.promotion_id ? `/shows/${show.promotion_id}/${show.id}` : "/shows"
            }
            className="group relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70"
            onClick={() =>
              posthog.capture("show_card_clicked", {
                source,
                show_id: show.id,
                show_name: show.name,
                promotion_id: show.promotion_id,
                show_status: show.status,
              })
            }
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
                  <span className="flex h-10 w-10 min-h-10 min-w-10 shrink-0 aspect-square items-center justify-center overflow-hidden rounded-full border border-amber-400/40 bg-black/50">
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
  );
};
