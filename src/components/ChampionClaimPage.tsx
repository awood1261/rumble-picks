"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  AVATAR_OPTIONS,
  DEFAULT_AVATAR_KEY,
  avatarSrcForKey,
} from "../lib/avatarOptions";
import { supabase } from "../lib/supabaseClient";
import { buildPromotionShowsHref } from "../lib/friendlyUrls";
import type {
  ChampionCompletedShow,
  ChampionPromotion,
} from "../lib/championTypes";

const CHAMPION_GUEST_ID_STORAGE_KEY = "boutpick_champion_guest_id";

const ensureChampionGuestId = () => {
  if (typeof window === "undefined") return null;
  const existing = window.localStorage.getItem(CHAMPION_GUEST_ID_STORAGE_KEY);
  if (existing) return existing;
  const next =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `champion-guest-${Date.now()}`;
  window.localStorage.setItem(CHAMPION_GUEST_ID_STORAGE_KEY, next);
  return next;
};

type ChampionClaimPageProps = {
  promotionId: string;
  promotion: ChampionPromotion | null;
};

export const ChampionClaimPage = ({
  promotionId,
  promotion,
}: ChampionClaimPageProps) => {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [codeId, setCodeId] = useState<string | null>(null);
  const [shows, setShows] = useState<ChampionCompletedShow[]>([]);
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  const [winnerDetailsByShowId, setWinnerDetailsByShowId] = useState<
    Record<string, ChampionCompletedShow>
  >({});
  const [selectedShowDetails, setSelectedShowDetails] =
    useState<ChampionCompletedShow | null>(null);
  const [claimMode, setClaimMode] = useState<"show_winner" | "champion_profile" | null>(
    null
  );
  const [profileUsername, setProfileUsername] = useState("");
  const [avatarKey, setAvatarKey] = useState(DEFAULT_AVATAR_KEY);
  const [claimedUserId, setClaimedUserId] = useState<string | null>(null);
  const [claimedGuestId, setClaimedGuestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isLoadingShowDetails, setIsLoadingShowDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hydrateIdentity = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const userId = data.session?.user.id ?? null;
      setClaimedUserId(userId);
      setClaimedGuestId(userId ? null : ensureChampionGuestId());
    };

    void hydrateIdentity();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedShow = useMemo(
    () => shows.find((show) => show.id === selectedShowId) ?? null,
    [selectedShowId, shows]
  );

  const resolvedClaimedUsername =
    claimMode === "champion_profile"
      ? profileUsername.trim()
      : selectedShowDetails?.winner_username ?? "";
  const resolvedClaimedAvatar =
    claimMode === "champion_profile"
      ? avatarKey
      : selectedShowDetails?.winner_avatar ?? DEFAULT_AVATAR_KEY;

  useEffect(() => {
    let cancelled = false;

    const loadShowDetails = async () => {
      if (!codeId || !selectedShowId) {
        setSelectedShowDetails(null);
        return;
      }

      const cachedShowDetails = winnerDetailsByShowId[selectedShowId];
      if (cachedShowDetails) {
        setSelectedShowDetails(cachedShowDetails);
        return;
      }

      setIsLoadingShowDetails(true);
      setError(null);

      try {
        const response = await fetch("/api/champion/show", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            promotionId,
            code,
            showId: selectedShowId,
          }),
        });
        const payload = (await response.json()) as {
          error?: string;
          show?: ChampionCompletedShow;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load show details.");
        }
        if (!cancelled) {
          const resolvedShow = payload.show ?? null;
          setSelectedShowDetails(resolvedShow);
          if (resolvedShow) {
            setWinnerDetailsByShowId((prev) => ({
              ...prev,
              [resolvedShow.id]: resolvedShow,
            }));
          }
        }
      } catch (nextError) {
        if (cancelled) return;
        const message =
          nextError instanceof Error
            ? nextError.message
            : "Failed to load show details.";
        setError(message);
        setSelectedShowDetails(null);
      } finally {
        if (!cancelled) {
          setIsLoadingShowDetails(false);
        }
      }
    };

    void loadShowDetails();
    return () => {
      cancelled = true;
    };
  }, [code, codeId, promotionId, selectedShowId, winnerDetailsByShowId]);

  const handleValidateCode = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsValidating(true);

    try {
      const response = await fetch("/api/champion/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promotionId, code }),
      });
      const payload = (await response.json()) as {
        error?: string;
        codeId?: string;
        shows?: ChampionCompletedShow[];
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Champion code validation failed.");
      }

      setCodeId(payload.codeId ?? null);
      setShows(payload.shows ?? []);
      setSelectedShowId(payload.shows?.[0]?.id ?? null);
      setWinnerDetailsByShowId({});
      setSelectedShowDetails(null);
      setClaimMode(null);
    } catch (nextError) {
      const message =
        nextError instanceof Error
          ? nextError.message
          : "Champion code validation failed.";
      setError(message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmitClaim = async () => {
    if (!codeId || !claimMode) return;

    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      let activeUserId = claimedUserId;
      let activeGuestId = claimedGuestId;

      if (!activeUserId) {
        const { data: anonData, error: anonError } =
          await supabase.auth.signInAnonymously({
            options: {
              data: {
                display_name: resolvedClaimedUsername || "Champion",
                avatar_key: resolvedClaimedAvatar,
              },
            },
          });
        if (anonError) {
          throw anonError;
        }
        activeUserId = anonData.user?.id ?? null;
        activeGuestId = null;
        setClaimedUserId(activeUserId);
        setClaimedGuestId(null);
      }

      const response = await fetch("/api/champion/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promotionId,
          codeId,
          code,
          showId: claimMode === "show_winner" ? selectedShowId : null,
          claimType: claimMode,
          claimedUsername:
            claimMode === "champion_profile" ? profileUsername : null,
          claimedAvatar:
            claimMode === "champion_profile" ? avatarKey : null,
          claimedByUserId: activeUserId,
          claimedByGuestId: activeGuestId,
        }),
      });
      const payload = (await response.json()) as { error?: string; claim?: { claimed_username?: string } };
      if (!response.ok) {
        throw new Error(payload.error ?? "Champion claim failed.");
      }

      if (activeUserId && resolvedClaimedUsername) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            display_name: resolvedClaimedUsername,
            avatar_key: resolvedClaimedAvatar,
          })
          .eq("id", activeUserId);
        if (profileError) {
          throw profileError;
        }

        const { error: authError } = await supabase.auth.updateUser({
          data: {
            display_name: resolvedClaimedUsername,
            avatar_key: resolvedClaimedAvatar,
          },
        });
        if (authError) {
          throw authError;
        }
      }

      setSuccessMessage(
        claimMode === "show_winner"
          ? `Champion status linked to ${payload.claim?.claimed_username ?? "the recorded winner"}.`
          : `Champion profile created for ${payload.claim?.claimed_username ?? profileUsername}.`
      );
      router.push(
        promotion ? buildPromotionShowsHref(promotion) : `/shows/${promotionId}`
      );
    } catch (nextError) {
      const message =
        nextError instanceof Error ? nextError.message : "Champion claim failed.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col px-4 py-10 text-zinc-100">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center gap-4">
          {promotion?.image_url ? (
            <Image
              src={promotion.image_url}
              alt={`${promotion.name} logo`}
              width={64}
              height={64}
              className="h-16 w-16 rounded-2xl border border-zinc-800 bg-zinc-900 object-contain p-2"
            />
          ) : null}
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-amber-300">
              Champion Access
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {promotion?.name ?? "Promotion"} Champion Claim
            </h1>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Enter the code from your champion card to choose the show you won for
          {" "}
          <span className="font-medium text-zinc-200">
            {promotion?.name ?? "this promotion"}
          </span>
          .
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            className="h-12 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-sm text-zinc-100"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="Enter your champion code"
          />
          <button
            type="button"
            onClick={() => void handleValidateCode()}
            disabled={isValidating || !code.trim()}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-amber-400 px-6 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isValidating ? "Checking…" : "Continue"}
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {codeId ? (
          <section className="mt-8 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                Choose the show you won
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Pick the event where you held this championship.
              </p>
            </div>

            <div className="grid gap-3">
              {shows.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 text-sm text-zinc-400">
                  There are no completed shows ready to claim for this promotion yet.
                </div>
              ) : (
                shows.map((show) => {
                  const isSelected = selectedShowId === show.id;
                  const cachedWinner = winnerDetailsByShowId[show.id];
                  const resolvedWinnerAvatarKey = isSelected
                    ? selectedShowDetails?.winner_avatar ??
                      cachedWinner?.winner_avatar ??
                      null
                    : cachedWinner?.winner_avatar ?? null;
                  const resolvedWinnerName = isSelected
                    ? isLoadingShowDetails
                      ? cachedWinner?.winner_username ?? "Loading…"
                      : selectedShowDetails?.winner_username ??
                        cachedWinner?.winner_username ??
                        "No winner available yet"
                    : cachedWinner?.winner_username ?? "Select show";
                  return (
                    <button
                      key={show.id}
                      type="button"
                      onClick={() => {
                        setSelectedShowId(show.id);
                        setClaimMode(null);
                        setSuccessMessage(null);
                      }}
                      className={`rounded-2xl border px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-amber-300 bg-amber-300/10"
                          : "border-zinc-800 bg-zinc-900/50 hover:border-amber-400/50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">
                            {show.name}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
                            {show.starts_at
                              ? new Date(show.starts_at).toLocaleString()
                              : "No date set"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">
                            Champ
                          </p>
                          <div className="mt-1 flex items-center justify-end gap-2">
                            {resolvedWinnerName !== "Select show" ? (
                              <Image
                                src={avatarSrcForKey(resolvedWinnerAvatarKey)}
                                alt={`${resolvedWinnerName} avatar`}
                                width={28}
                                height={28}
                                className="h-7 w-7 rounded-full border border-zinc-700 bg-zinc-900 object-cover"
                              />
                            ) : null}
                            <p className="text-sm text-zinc-100">{resolvedWinnerName}</p>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {selectedShow ? (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
                <p className="text-xs uppercase tracking-[0.32em] text-amber-300">
                  Championship Preview
                </p>
                <h3 className="mt-3 text-xl font-semibold text-zinc-100">
                  {selectedShow.name}
                </h3>
                {selectedShowDetails?.winner_username ? (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                    <Image
                      src={avatarSrcForKey(selectedShowDetails.winner_avatar)}
                      alt={`${selectedShowDetails.winner_username} avatar`}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full border border-zinc-700 bg-zinc-900 object-cover"
                    />
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.24em] text-amber-300">
                        Recorded champ
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-100">
                        {selectedShowDetails.winner_username}
                      </p>
                    </div>
                  </div>
                ) : null}
                <p className="mt-3 text-sm text-zinc-300">
                  Claiming this show will mark the winner as a champion in the app.
                  This includes:
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-400">
                  <li>Champion badge on the scoreboard</li>
                  <li>Inclusion in Previous Champions Playing Tonight</li>
                </ul>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setClaimMode("show_winner")}
                    disabled={isLoadingShowDetails || !selectedShowDetails?.winner_username}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      claimMode === "show_winner"
                        ? "border-amber-300 bg-amber-300/10"
                        : "border-zinc-700 bg-zinc-950/60 hover:border-amber-400/50"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <p className="text-sm font-semibold text-zinc-100">That’s me</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Use the winner already recorded for this show:
                      {" "}
                      <span className="text-zinc-200">
                        {isLoadingShowDetails
                          ? "Loading…"
                          : selectedShowDetails?.winner_username ?? "Unavailable"}
                      </span>
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClaimMode("champion_profile")}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      claimMode === "champion_profile"
                        ? "border-amber-300 bg-amber-300/10"
                        : "border-zinc-700 bg-zinc-950/60 hover:border-amber-400/50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-zinc-100">
                      Use a different name
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Create a new champion profile for future appearances.
                    </p>
                  </button>
                </div>

                {claimMode === "champion_profile" ? (
                  <div className="mt-5 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <input
                      className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100"
                      value={profileUsername}
                      onChange={(event) => setProfileUsername(event.target.value)}
                      placeholder="Choose your champion name"
                    />
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                      {AVATAR_OPTIONS.map((option) => {
                        const isActive = avatarKey === option.key;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setAvatarKey(option.key)}
                            className={`rounded-2xl border p-2 transition ${
                              isActive
                                ? "border-amber-300 bg-amber-300/10"
                                : "border-zinc-800 bg-zinc-900/60 hover:border-amber-400/50"
                            }`}
                          >
                            <Image
                              src={option.src}
                              alt={option.label}
                              width={64}
                              height={64}
                              className="mx-auto h-12 w-12 object-contain"
                            />
                            <span className="mt-2 block text-[10px] uppercase tracking-[0.16em] text-zinc-300">
                              {option.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleSubmitClaim()}
                  disabled={
                    isSubmitting ||
                    !claimMode ||
                    (claimMode === "champion_profile" && !profileUsername.trim())
                  }
                  className="mt-5 inline-flex h-12 items-center justify-center rounded-2xl bg-amber-400 px-6 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Saving…" : "Confirm"}
                </button>

                {successMessage ? (
                  <p className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    {successMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
};
