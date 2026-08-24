"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { avatarSrcForKey } from "../../../../lib/avatarOptions";
import type { PromotionRow, ShowRow } from "../../../../lib/picksTypes";
import {
  LOCATION_GATE_GEOLOCATION_OPTIONS,
  evaluateLocationGate,
  getStoredLocationVerification,
  isValidLocationGateConfig,
  saveLocationVerification,
} from "../../../../lib/locationGate";
import type {
  ChampionParticipant,
  PromotionChampionshipStatus,
} from "../../../../lib/championTypes";
import posthog from "posthog-js";

const BOUTPICK_FPC_BELT_URL =
  "https://fqfufzrebrxubrechdal.supabase.co/storage/v1/object/public/belts/boutpick/bout-pick-prediction-title.png";

type LocationVerificationStatus =
  | "idle"
  | "checking"
  | "verified"
  | "outside"
  | "permission_denied"
  | "unavailable"
  | "timeout"
  | "imprecise"
  | "unsupported"
  | "invalid_config";

type PrimaryAction =
  | {
      kind: "button";
      label: string;
      eyebrow: string;
      title: string;
      detail: string;
      onClick: () => void;
      disabled?: boolean;
    }
  | {
      kind: "link";
      label: string;
      eyebrow: string;
      title: string;
      detail: string;
      href: string;
    }
  | {
      kind: "locked";
      label: string;
      eyebrow: string;
      title: string;
      detail: string;
      href: string;
    };

const formatShowDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatVenueLabel = (show: ShowRow | null) =>
  show?.venue_name?.trim() || "the venue";

const getLocationCopy = (
  status: LocationVerificationStatus,
  venueLabel: string,
) => {
  switch (status) {
    case "checking":
      return {
        eyebrow: "Play at the show",
        title: "Checking Location",
        detail: "Confirming your device is at the venue.",
        label: "Checking...",
      };
    case "verified":
      return {
        eyebrow: "You are in",
        title: "Picks Are Unlocked",
        detail: "Location is verified for this show.",
        label: "Continue",
      };
    case "outside":
      return {
        eyebrow: "Outside play area",
        title: "Move Closer To The Venue",
        detail: `You need to be at ${venueLabel} to make picks.`,
        label: "Try Again",
      };
    case "permission_denied":
      return {
        eyebrow: "Permission needed",
        title: "Enable Location Access",
        detail: "Allow browser location for this show, then try again.",
        label: "Try Again",
      };
    case "timeout":
      return {
        eyebrow: "Location timed out",
        title: "Try From The Venue",
        detail: "Your browser took too long to verify location.",
        label: "Try Again",
      };
    case "imprecise":
      return {
        eyebrow: "Location unclear",
        title: "Try Again Nearby",
        detail: "Your browser returned a location that was too imprecise.",
        label: "Try Again",
      };
    case "unavailable":
      return {
        eyebrow: "Location unavailable",
        title: "Location Could Not Be Checked",
        detail: "Your browser could not determine your location.",
        label: "Try Again",
      };
    case "unsupported":
      return {
        eyebrow: "Unsupported browser",
        title: "Location Is Required",
        detail: "Use a browser with geolocation support for this show.",
        label: "Unavailable",
      };
    case "invalid_config":
      return {
        eyebrow: "Setup needed",
        title: "Location Gate Not Ready",
        detail: "This show is missing venue coordinates or a radius.",
        label: "Unavailable",
      };
    default:
      return {
        eyebrow: "Play at the show",
        title: "Verify Attendance",
        detail: `Verify you are at ${venueLabel} to unlock tonight's picks.`,
        label: "Verify Location",
      };
  }
};

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
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hasSavedPicks, setHasSavedPicks] = useState(false);
  const [pickStatusChecked, setPickStatusChecked] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [locationVerificationStatus, setLocationVerificationStatus] =
    useState<LocationVerificationStatus>("idle");
  const [locationVerificationDetail, setLocationVerificationDetail] =
    useState<string | null>(null);

  const locationGateConfig = useMemo(
    () => ({
      venueLatitude: show?.venue_latitude,
      venueLongitude: show?.venue_longitude,
      radiusMeters: show?.location_radius_meters,
    }),
    [show?.location_radius_meters, show?.venue_latitude, show?.venue_longitude]
  );
  const requiresLocationVerification = !!show?.requires_location_verification;
  const hasValidLocationGateConfig =
    isValidLocationGateConfig(locationGateConfig);
  const formattedStart = formatShowDate(show?.starts_at ?? null);
  const venueLabel = formatVenueLabel(show);
  const isShowOver = Boolean(show?.is_over);
  const hasStarted = (() => {
    if (!show?.starts_at) return false;
    const startTime = new Date(show.starts_at).getTime();
    return !Number.isNaN(startTime) && startTime <= now;
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
          "id, name, tagline, image_url, starts_at, status, promotion_id, requires_email_registration, lock_picks_at_start, is_over, requires_location_verification, venue_name, venue_address, venue_latitude, venue_longitude, location_radius_meters"
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
  }, [show?.id, show?.name, show?.promotion_id, show?.status]);

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
        setUserId(data.user.id);
      } else {
        setIsSignedIn(false);
        setUserId(null);
      }
      setAuthChecked(true);
    };
    loadUser();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const loadPickStatus = async () => {
      if (!showId || !userId) {
        setHasSavedPicks(false);
        setPickStatusChecked(Boolean(authChecked));
        return;
      }

      setPickStatusChecked(false);
      const { data, error } = await supabase
        .from("picks")
        .select("id")
        .eq("show_id", showId)
        .eq("user_id", userId)
        .maybeSingle();

      if (ignore) return;
      setHasSavedPicks(!error && Boolean(data));
      setPickStatusChecked(true);
    };

    loadPickStatus();
    return () => {
      ignore = true;
    };
  }, [authChecked, showId, userId]);

  useEffect(() => {
    if (!show?.id || !requiresLocationVerification) {
      setLocationVerificationStatus("idle");
      setLocationVerificationDetail(null);
      return;
    }
    if (!hasValidLocationGateConfig) {
      setLocationVerificationStatus("invalid_config");
      setLocationVerificationDetail(
        "This show is missing venue coordinates or a radius."
      );
      return;
    }

    const storedVerification = getStoredLocationVerification({
      showId: show.id,
      userId,
    });
    if (storedVerification) {
      setLocationVerificationStatus("verified");
      setLocationVerificationDetail(
        "Location already verified for this show."
      );
    } else {
      setLocationVerificationStatus("idle");
      setLocationVerificationDetail(null);
    }
  }, [
    hasValidLocationGateConfig,
    requiresLocationVerification,
    show?.id,
    userId,
  ]);

  const handleVerifyLocation = () => {
    if (!show?.id) return;
    if (!hasValidLocationGateConfig) {
      setLocationVerificationStatus("invalid_config");
      setLocationVerificationDetail(
        "This show is missing venue coordinates or a radius."
      );
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationVerificationStatus("unsupported");
      setLocationVerificationDetail(
        "This browser does not support location verification."
      );
      return;
    }

    setLocationVerificationStatus("checking");
    setLocationVerificationDetail("Checking your location for this show...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const result = evaluateLocationGate(locationGateConfig, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });

        if (result.status === "inside") {
          saveLocationVerification({
            showId: show.id,
            userId,
            showStartsAt: show.starts_at,
          });
          setLocationVerificationStatus("verified");
          setLocationVerificationDetail(
            "Location verified for this show. You can continue to picks."
          );
          posthog.capture("show_location_verified", {
            show_id: show.id,
            promotion_id: show.promotion_id,
          });
          return;
        }

        if (result.status === "inconclusive") {
          setLocationVerificationStatus("imprecise");
          setLocationVerificationDetail(
            "Your browser returned an imprecise location. Try again from the venue."
          );
          return;
        }

        if (result.status === "outside") {
          setLocationVerificationStatus("outside");
          setLocationVerificationDetail(
            "Your device does not appear to be inside the venue area for this show."
          );
          return;
        }

        setLocationVerificationStatus("invalid_config");
        setLocationVerificationDetail(
          "This show is missing venue coordinates or a radius."
        );
      },
      (error) => {
        if (error.code === 1) {
          setLocationVerificationStatus("permission_denied");
          setLocationVerificationDetail(
            "Location permission is needed for this show. Enable location access and try again."
          );
          return;
        }
        if (error.code === 3) {
          setLocationVerificationStatus("timeout");
          setLocationVerificationDetail(
            "Location verification timed out. Try again near the venue."
          );
          return;
        }
        setLocationVerificationStatus("unavailable");
        setLocationVerificationDetail(
          "Your browser could not determine your location. Try again near the venue."
        );
      },
      LOCATION_GATE_GEOLOCATION_OPTIONS
    );
  };

  const isLocked =
    !!show?.starts_at &&
    (show.lock_picks_at_start ?? true) &&
    new Date(show.starts_at).getTime() <= now;
  const scoreboardHref = show ? `/scoreboard?show=${show.id}` : "/scoreboard";
  const picksHref = show ? `/picks?show=${show.id}` : "/picks";
  const loginHref = show ? `/login?show=${show.id}` : "/login";
  const titleHref = promotionId ? `/title/${promotionId}` : "/title";
  const locationCopy = getLocationCopy(locationVerificationStatus, venueLabel);
  const canRetryLocation =
    locationVerificationStatus !== "checking" &&
    locationVerificationStatus !== "verified" &&
    locationVerificationStatus !== "invalid_config" &&
    locationVerificationStatus !== "unsupported";
  const primaryAction: PrimaryAction | null = show
    ? isShowOver
      ? {
          kind: "locked",
          label: "View Results",
          eyebrow: "Show complete",
          title: "Results Are Ready",
          detail: "See the final leaderboard and score breakdown.",
          href: scoreboardHref,
        }
      : isLocked
        ? {
            kind: "locked",
            label: hasStarted ? "Follow Live" : "View Leaderboard",
            eyebrow: hasStarted ? "Picks locked" : "Locked",
            title: hasStarted ? "Follow The Scores" : "Picks Are Locked",
            detail: hasStarted
              ? "Track the live leaderboard as results come in."
              : "Picks are closed for this show.",
            href: scoreboardHref,
          }
        : requiresLocationVerification &&
            locationVerificationStatus !== "verified"
          ? {
              kind: "button",
              label: locationCopy.label,
              eyebrow: locationCopy.eyebrow,
              title: locationCopy.title,
              detail: locationCopy.detail,
              onClick: handleVerifyLocation,
              disabled:
                locationVerificationStatus === "checking" ||
                !canRetryLocation,
            }
          : !authChecked
            ? {
                kind: "button",
                label: "Checking...",
                eyebrow: "Getting ready",
                title: "Checking Access",
                detail: "Confirming whether you can enter picks.",
                onClick: () => undefined,
                disabled: true,
              }
          : !isSignedIn
            ? {
                kind: "link",
                label: show.requires_email_registration
                  ? "Sign In To Play"
                  : "Create Profile",
                eyebrow: "Join the game",
                title: "Make Your Picks",
                detail: show.requires_email_registration
                  ? "Sign in to enter tonight's predictions."
                  : "Create a quick profile to enter tonight's predictions.",
                href: loginHref,
              }
            : {
                kind: "link",
                label:
                  pickStatusChecked && hasSavedPicks
                    ? "View My Picks"
                    : "Make Your Picks",
                eyebrow:
                  pickStatusChecked && hasSavedPicks
                    ? "Picks saved"
                    : "Picks open",
                title:
                  pickStatusChecked && hasSavedPicks
                    ? "Review Or Update Picks"
                    : "Enter Tonight's Picks",
                detail:
                  pickStatusChecked && hasSavedPicks
                    ? "Your picks can be updated until the show locks."
                    : "Predict the matches before picks close.",
                href: picksHref,
              }
    : null;

  const championshipLabel = championshipStatus
    ? championshipStatus.status === "inaugural"
      ? "Inaugural"
      : championshipStatus.status === "defending"
        ? "Defending"
        : "Vacant"
    : null;
  const championshipDetail = championshipStatus
    ? championshipStatus.status === "inaugural"
      ? "The first champion for this promotion can be crowned tonight."
      : championshipStatus.status === "defending"
        ? `${championshipStatus.champion_username ?? "The champion"} defends the title tonight.`
        : "A new champion will be crowned tonight."
    : null;

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
    <div className="relative min-h-[calc(100vh-73px)] overflow-hidden text-zinc-100">
      {show?.image_url ? (
        <Image
          src={show.image_url}
          alt={show.name}
          fill
          priority
          sizes="100vw"
          className="object-cover lg:object-top"
        />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#111827_0%,#09090b_45%,#000_100%)]" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.44)_36%,rgba(0,0,0,0.92)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.22)_0%,rgba(0,0,0,0)_54%)]" />
      <main className="relative mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-6xl flex-col px-5 pb-8 pt-5 sm:px-8 lg:px-10">
        {message && (
          <div className="mb-4 rounded-lg border border-zinc-800 bg-black/70 px-4 py-3 text-sm text-zinc-200">
            {message}
          </div>
        )}

        {!show ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-zinc-400">Loading show...</p>
          </div>
        ) : (
          <div className="grid flex-1 content-start gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-end lg:gap-8">
            <section className="flex min-h-[42vh] flex-col justify-end pt-6 text-center sm:min-h-[48vh] lg:min-h-[calc(100vh-145px)] lg:text-left">
              <div className="mx-auto max-w-3xl lg:mx-0">
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
                  {promotion?.image_url ? (
                    <div className="flex h-16 w-16 min-h-16 min-w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-amber-300/45 bg-black/55 shadow-[0_0_30px_rgba(251,191,36,0.18)]">
                      <Image
                        src={promotion.image_url}
                        alt={promotion?.name ?? show.name}
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <p className="break-words text-[11px] font-semibold uppercase text-amber-200 sm:text-xs">
                      {promotion?.name ?? "BoutPick Show"}
                    </p>
                    <p className="mt-1 break-words text-xs font-semibold uppercase text-zinc-300">
                      {formattedStart ?? "Show date TBD"}
                    </p>
                  </div>
                </div>

                <h1 className="mx-auto mt-6 max-w-[12ch] break-words text-5xl font-black uppercase leading-[0.9] text-zinc-100 drop-shadow-[0_3px_18px_rgba(0,0,0,0.9)] sm:max-w-[16ch] sm:text-6xl lg:mx-0 lg:text-7xl">
                  {show.name}
                </h1>

                {show.tagline ? (
                  <p className="mx-auto mt-4 max-w-xl break-words text-base font-semibold text-amber-100 drop-shadow sm:text-lg lg:mx-0">
                    {show.tagline}
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-semibold uppercase text-zinc-200 lg:justify-start">
                  <span>{venueLabel}</span>
                  <span className="h-4 w-px bg-amber-300/60" aria-hidden="true" />
                  <span>{lockStatusText}</span>
                </div>

                <p className="mx-auto mt-7 max-w-xl text-lg font-medium italic text-zinc-100 sm:text-xl lg:mx-0">
                  Predict the matches. Earn points.{" "}
                  <span className="text-amber-300">Top the leaderboard.</span>
                </p>
              </div>
            </section>

            <aside className="space-y-4 self-end pb-1 lg:pb-6">
              {primaryAction ? (
                <section
                  className={`rounded-lg border p-5 shadow-[0_0_38px_rgba(251,191,36,0.16)] backdrop-blur-md ${
                    primaryAction.kind === "button" &&
                    locationVerificationStatus !== "idle" &&
                    locationVerificationStatus !== "checking"
                      ? "border-amber-300/70 bg-black/78"
                      : "border-amber-300/80 bg-black/72"
                  }`}
                  aria-live="polite"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-300/70 bg-amber-300/12 text-2xl text-amber-300">
                      <span aria-hidden="true">
                        {primaryAction.kind === "button" ? "⌖" : "›"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="break-words text-xs font-semibold uppercase text-amber-300">
                        {primaryAction.eyebrow}
                      </p>
                      <h2 className="mt-2 break-words text-2xl font-black uppercase leading-tight text-zinc-100">
                        {primaryAction.title}
                      </h2>
                      <p className="mt-3 break-words text-sm leading-6 text-zinc-300">
                        {primaryAction.detail}
                      </p>
                    </div>
                  </div>

                  {locationVerificationDetail ? (
                    <p className="sr-only">{locationVerificationDetail}</p>
                  ) : null}

                  {primaryAction.kind === "button" ? (
                    <button
                      className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-amber-400 px-5 text-center text-sm font-black uppercase text-black transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      onClick={primaryAction.onClick}
                      disabled={primaryAction.disabled}
                    >
                      {primaryAction.label}
                    </button>
                  ) : (
                    <Link
                      href={primaryAction.href}
                      className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-amber-400 px-5 text-center text-sm font-black uppercase text-black transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-black"
                    >
                      {primaryAction.label}
                    </Link>
                  )}
                </section>
              ) : null}

              <Link
                href={scoreboardHref}
                className="flex min-h-12 items-center justify-center gap-3 text-center text-sm font-black uppercase text-zinc-300 transition hover:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-black"
              >
                <span className="text-xl text-zinc-400" aria-hidden="true">
                  ⇧
                </span>
                <span>View Leaderboard</span>
                <span className="text-xl" aria-hidden="true">
                  →
                </span>
              </Link>

              {championshipStatusLoading ? (
                <section className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 rounded-lg border border-zinc-700/80 bg-black/55 p-4 backdrop-blur-md sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4">
                  <div className="h-16 animate-pulse rounded-lg bg-amber-200/10 sm:h-20" />
                  <div>
                    <div className="h-3 w-28 animate-pulse rounded-full bg-zinc-300/15" />
                    <div className="mt-3 h-7 w-24 animate-pulse rounded-full bg-amber-200/20" />
                    <div className="mt-3 h-10 animate-pulse rounded-lg bg-zinc-300/10" />
                  </div>
                </section>
              ) : championshipStatus ? (
                <Link
                  href={titleHref}
                  className="grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-zinc-700/80 bg-black/55 p-4 backdrop-blur-md transition hover:border-amber-300/70 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-black sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:gap-4"
                >
                  <div className="relative h-16 sm:h-20">
                    <Image
                      src={BOUTPICK_FPC_BELT_URL}
                      alt="BoutPick championship belt"
                      fill
                      sizes="7rem"
                      className="object-contain drop-shadow-[0_0_18px_rgba(251,191,36,0.28)]"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="break-words text-xs font-black uppercase text-zinc-100">
                      BoutPick Championship
                    </p>
                    <p className="mt-2 break-words text-2xl font-black uppercase text-amber-300">
                      {championshipLabel}
                    </p>
                    <p className="mt-2 break-words text-sm leading-5 text-zinc-300">
                      {championshipDetail}
                    </p>
                    {championshipStatus.status === "defending" &&
                    championshipStatus.champion_username ? (
                      <div className="mt-3 flex min-w-0 items-center gap-2">
                        <Image
                          src={avatarSrcForKey(championshipStatus.champion_avatar)}
                          alt={`${championshipStatus.champion_username} avatar`}
                          width={28}
                          height={28}
                          className="h-7 w-7 shrink-0 rounded-full border border-amber-300/40 bg-black/40"
                        />
                        <span className="min-w-0 break-words text-xs font-semibold uppercase text-zinc-200">
                          {championshipStatus.champion_username}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <span className="text-3xl text-amber-300" aria-hidden="true">
                    →
                  </span>
                </Link>
              ) : null}

              {championParticipants.length > 0 ? (
                <section className="rounded-lg border border-zinc-800/90 bg-black/45 p-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase text-zinc-400">
                    Previous champions playing tonight
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {championParticipants.map((participant) => (
                      <div
                        key={participant.user_id}
                        className="flex min-w-0 items-center gap-2 rounded-full border border-zinc-700/80 bg-black/50 px-3 py-2"
                      >
                        <Image
                          src={avatarSrcForKey(participant.avatar_key)}
                          alt={`${participant.display_name} avatar`}
                          width={24}
                          height={24}
                          className="h-6 w-6 shrink-0 rounded-full border border-zinc-700 bg-black/40"
                        />
                        <span className="max-w-32 truncate text-xs font-semibold text-zinc-200">
                          {participant.display_name}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {requiresLocationVerification ? (
                <p className="px-1 text-center text-xs text-zinc-500">
                  Location is used once for this show and exact coordinates are
                  not stored.
                </p>
              ) : null}
            </aside>
          </div>
        )}

      </main>
    </div>
  );
}
