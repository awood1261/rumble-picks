"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { avatarSrcForKey } from "../../../../lib/avatarOptions";
import type { PromotionRow, ShowRow } from "../../../../lib/picksTypes";
import type {
  ChampionParticipant,
  PromotionChampionshipStatus,
} from "../../../../lib/championTypes";
import posthog from "posthog-js";

const BOUTPICK_FPC_BELT_URL =
  "https://fqfufzrebrxubrechdal.supabase.co/storage/v1/object/public/belts/boutpick/boutpick-fpc-belt.png";

export default function ShowDetailPage() {
  const params = useParams();
  const showId = typeof params?.showId === "string" ? params.showId : "";
  const promotionId =
    typeof params?.promotionId === "string" ? params.promotionId : "";
  const [show, setShow] = useState<ShowRow | null>(null);
  const [promotion, setPromotion] = useState<PromotionRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [championParticipants, setChampionParticipants] = useState<
    ChampionParticipant[]
  >([]);
  const [championshipStatus, setChampionshipStatus] =
    useState<PromotionChampionshipStatus | null>(null);
  const [championshipStatusLoading, setChampionshipStatusLoading] =
    useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const formattedStart = (() => {
    if (!show?.starts_at) return null;
    const date = new Date(show.starts_at);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  })();

  const lockStatusText = (() => {
    const locksAtStart = show?.lock_picks_at_start ?? true;
    if (!show?.starts_at) {
      return "Lock time not set";
    }
    const startTime = new Date(show.starts_at).getTime();
    const diffMs = startTime - now;
    if (diffMs <= 0) {
      return locksAtStart ? "Show is locked" : "Live picks are open";
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
    return locksAtStart
      ? `Picks lock in ${parts.join(" ")}`
      : `Show starts in ${parts.join(" ")}`;
  })();

  useEffect(() => {
    let ignore = false;
    if (!showId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("shows")
        .select(
          "id, name, tagline, image_url, starts_at, status, promotion_id, requires_email_registration, lock_picks_at_start"
        )
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
    if (!show?.id || typeof window === "undefined") return;
    window.localStorage.setItem("bp:lastShowId", show.id);
    posthog.capture("show_viewed", {
      show_id: show.id,
      show_name: show.name,
      show_status: show.status,
      promotion_id: show.promotion_id,
    });
  }, [show?.id]);

  useEffect(() => {
    if (!show?.starts_at) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [show?.starts_at]);

  useEffect(() => {
    let ignore = false;
    if (!showId || !promotionId) return;

    const loadChampionParticipants = async () => {
      const response = await fetch("/api/champion/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          promotionId,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        participants?: ChampionParticipant[];
      };
      if (ignore) return;
      if (!response.ok) {
        setChampionParticipants([]);
        return;
      }
      setChampionParticipants(payload.participants ?? []);
    };

    void loadChampionParticipants();
    return () => {
      ignore = true;
    };
  }, [promotionId, showId]);

  useEffect(() => {
    let ignore = false;
    if (!showId || !promotionId) return;

    const loadChampionshipStatus = async () => {
      setChampionshipStatusLoading(true);
      try {
        const response = await fetch("/api/champion/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            showId,
            promotionId,
          }),
        });
        const payload = (await response.json()) as {
          error?: string;
          championship?: PromotionChampionshipStatus;
        };
        if (ignore) return;
        if (!response.ok) {
          setChampionshipStatus(null);
          return;
        }
        setChampionshipStatus(payload.championship ?? null);
      } catch {
        setChampionshipStatus(null);
      } finally {
        if (!ignore) {
          setChampionshipStatusLoading(false);
        }
      }
    };

    void loadChampionshipStatus();
    return () => {
      ignore = true;
    };
  }, [promotionId, showId]);

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
        <Image
          src={show.image_url}
          alt={show.name}
          fill
          priority
          sizes="100vw"
          className="object-cover"
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
                <div className="h-12 w-12 min-h-12 min-w-12 shrink-0 aspect-square overflow-hidden rounded-full border border-amber-400/40 bg-black/40">
                  <Image
                    src={promotion.image_url}
                    alt={promotion?.name ?? show.name}
                    width={48}
                    height={48}
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
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-200">
                  <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1">
                    <span className="text-amber-200">🔒</span>
                    {lockStatusText}
                  </span>
                </p>
              </div>
            </div>
            {show.tagline ? (
              <p className="mt-4 text-sm text-amber-100 sm:text-base">
                {show.tagline}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              {lockStatusText !== "Show is locked" && isSignedIn ? (
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
            {championshipStatusLoading ? (
              <section className="mt-6 overflow-hidden rounded-3xl border border-amber-400/20 bg-black/40 p-5 backdrop-blur-sm sm:p-6">
                <div className="grid gap-4 sm:grid-cols-[9rem_1fr] sm:items-center">
                  <div className="mx-auto h-40 w-full animate-pulse rounded-3xl bg-amber-200/10 sm:h-36 sm:w-36" />
                  <div>
                    <div className="h-3 w-32 animate-pulse rounded-full bg-amber-200/15" />
                    <div className="mt-3 h-8 w-44 animate-pulse rounded-full bg-amber-200/20" />
                    <div className="mt-4 h-16 animate-pulse rounded-2xl bg-zinc-200/10" />
                    <div className="mt-3 h-3 w-36 animate-pulse rounded-full bg-zinc-200/10" />
                  </div>
                </div>
              </section>
            ) : championshipStatus ? (
              <section className="mt-6 overflow-hidden rounded-3xl border border-amber-400/35 bg-black/55 shadow-[0_0_40px_rgba(251,196,0,0.08)] backdrop-blur-sm">
                <div className="px-5 pb-1 pt-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300/40 bg-amber-300/10 text-base text-amber-200">
                      🏆
                    </span>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-100">
                      Title Status:
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-[0.18em] ${
                        championshipStatus.status === "inaugural"
                          ? "border border-sky-300/40 bg-sky-300/12 text-sky-100"
                          : championshipStatus.status === "defending"
                            ? "border border-amber-300/40 bg-amber-300/12 text-amber-100"
                            : "border border-zinc-300/30 bg-zinc-300/10 text-zinc-100"
                      }`}
                    >
                      {championshipStatus.status === "inaugural"
                        ? "Inaugural"
                        : championshipStatus.status === "defending"
                          ? "Defending"
                          : "Vacant"}
                    </span>
                  </div>
                </div>
                <div className="grid gap-2 px-5 pb-4 pt-1 sm:grid-cols-[9rem_1fr] sm:items-center sm:px-6 sm:pb-5 sm:pt-2">
                  <div className="relative mx-auto h-40 w-full max-w-none sm:h-36 sm:w-36 sm:max-w-[9rem]">
                    <Image
                      src={BOUTPICK_FPC_BELT_URL}
                      alt="BoutPick championship belt"
                      fill
                      sizes="(min-width: 640px) 9rem, 100vw"
                      className="object-contain drop-shadow-[0_0_26px_rgba(251,196,0,0.28)]"
                    />
                  </div>
                  <div>
                    {championshipStatus.status === "defending" &&
                    championshipStatus.champion_username ? (
                      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-black/40 px-3 py-3">
                        <Image
                          src={avatarSrcForKey(championshipStatus.champion_avatar)}
                          alt={`${championshipStatus.champion_username} avatar`}
                          width={56}
                          height={56}
                          className="h-14 w-14 rounded-full border border-amber-300/40 bg-black/40"
                        />
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-amber-200">
                            Reigning champion
                          </p>
                          <p className="mt-1 text-lg font-semibold text-zinc-100">
                            {championshipStatus.champion_username}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    <p className="mt-3 text-sm text-zinc-200 sm:text-base">
                      {championshipStatus.status === "inaugural"
                        ? "This is the first championship opportunity for this promotion."
                        : championshipStatus.status === "defending"
                          ? "The title is on line tonight, will the champion retain or will a new contender bring down the champ? Play now!"
                          : `${
                              championshipStatus.champion_username ?? "The previous champion"
                            } is not registered for tonight, so the championship is vacant.`}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
            {championParticipants.length > 0 ? (
              <section className="mt-6 rounded-3xl border border-amber-400/25 bg-black/45 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.28em] text-amber-200">
                  Previous Champions Playing Tonight
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {championParticipants.map((participant) => (
                    <div
                      key={participant.user_id}
                      className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-black/40 px-3 py-3"
                    >
                      <Image
                        src={avatarSrcForKey(participant.avatar_key)}
                        alt={`${participant.display_name} avatar`}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full border border-zinc-700 bg-black/40"
                      />
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">
                          {participant.display_name}
                        </p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-amber-200">
                          Champion
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {authChecked && !isSignedIn && lockStatusText !== "Show is locked" ? (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-zinc-200">
                  {show?.requires_email_registration
                    ? "Email registration is required for this show."
                    : "Create a quick profile to lock your picks."}
                </p>
                <Link
                  href={`/login?show=${show.id}`}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-amber-400 px-6 text-xs font-semibold uppercase tracking-wide text-zinc-900 transition hover:bg-amber-300"
                >
                  {show?.requires_email_registration
                    ? "Sign in to make picks"
                    : "Create profile"}
                </Link>
              </div>
            ) : null}
          </div>
        )}

      </main>
    </div>
  );
}
