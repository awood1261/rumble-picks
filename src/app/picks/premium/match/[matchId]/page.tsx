"use client";

import Image from "next/image";
import Link from "next/link";
import { Press_Start_2P, VT323 } from "next/font/google";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PremiumMatchupBackground } from "../../../../../components/premium/PremiumMatchupBackground";
import {
  loadPremiumMatchSceneData,
  savePremiumMatchPick,
  type PremiumMatchSceneData,
} from "../../../../../lib/premiumPicksData";
import {
  getPremiumEntrantSpriteUrl,
  type PremiumSpriteState,
} from "../../../../../lib/premiumMode";
import { supabase } from "../../../../../lib/supabaseClient";

const pressStart2P = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
});

const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
});

const spriteStateForSide = (
  selectedSideId: string | null,
  sideId: string,
): PremiumSpriteState => {
  if (!selectedSideId) return "neutral";
  return selectedSideId === sideId ? "victory" : "defeat";
};

export default function PremiumMatchPage() {
  const params = useParams<{ matchId: string }>();
  const searchParams = useSearchParams();
  const showId = searchParams.get("show");
  const matchId = params.matchId;
  const [scene, setScene] = useState<PremiumMatchSceneData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      if (!showId || !matchId) {
        if (isActive) {
          setScene(null);
          setMessage("Open this premium match from a premium show map.");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setMessage(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const nextUserId = session?.user?.id ?? null;
        const data = await loadPremiumMatchSceneData(showId, matchId, nextUserId);

        if (!isActive) return;
        setUserId(nextUserId);
        setScene(data);
        if (!data) {
          setMessage("That premium matchup could not be found.");
        } else if (data.sides.length < 2) {
          setMessage("This premium screen currently supports matches with two sides.");
        }
      } catch (error) {
        if (!isActive) return;
        setScene(null);
        setMessage(error instanceof Error ? error.message : "Unable to load premium matchup.");
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      isActive = false;
    };
  }, [matchId, showId]);

  const backHref = showId ? `/picks/premium?show=${showId}` : "/picks/premium";
  const matchSides = useMemo(() => scene?.sides.slice(0, 2) ?? [], [scene]);

  const handleSelectSide = async (sideId: string) => {
    if (!scene || !showId || !userId) {
      setMessage("Sign in is required before saving premium picks.");
      return;
    }

    const nextPayload = {
      ...scene.payload,
      match_picks: {
        ...(scene.payload.match_picks ?? {}),
        [scene.match.id]: sideId,
      },
    };

    setSaving(true);
    setMessage(null);

    try {
      await savePremiumMatchPick(showId, userId, nextPayload);
      setScene({
        ...scene,
        payload: nextPayload,
        selectedSideId: sideId,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save premium pick.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-amber-50">
      <PremiumMatchupBackground />

      <main className="relative z-10 flex min-h-screen flex-col px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start justify-between gap-4">
          <Link
            href={backHref}
            className={`${pressStart2P.className} inline-flex items-center rounded-full border border-amber-200/40 bg-black/55 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-amber-100 transition hover:border-amber-100/70 hover:text-white`}
          >
            Map
          </Link>
          <div className="rounded-2xl border border-amber-200/15 bg-black/50 px-4 py-3 text-right shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
            <p
              className={`${pressStart2P.className} text-[10px] uppercase tracking-[0.18em] text-amber-200/80`}
            >
              Premium Match
            </p>
            <p
              className={`${vt323.className} mt-2 text-2xl uppercase tracking-[0.08em] text-amber-50/85`}
            >
              {scene?.match.name ?? "Loading"}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-start">
          <div className="mx-auto flex w-full max-w-6xl flex-1 items-start justify-center pb-6 pt-24 sm:pt-28">
            {loading ? (
              <div className="rounded-full border border-amber-200/20 bg-black/65 px-5 py-3">
                <p
                  className={`${vt323.className} text-[1.8rem] uppercase tracking-[0.08em] text-amber-100`}
                >
                  Loading matchup...
                </p>
              </div>
            ) : scene && matchSides.length === 2 ? (
              <div className="relative grid w-full grid-cols-2 items-end gap-2 sm:gap-6">
                {matchSides.map((side, index) => {
                  const selectedSideId = scene.selectedSideId;
                  const spriteState = spriteStateForSide(selectedSideId, side.side.id);
                  const featuredEntrant = side.entrants[0] ?? null;
                  const spriteUrl = getPremiumEntrantSpriteUrl(featuredEntrant, spriteState);
                  const isSelected = selectedSideId === side.side.id;

                  return (
                    <button
                      key={side.side.id}
                      type="button"
                      disabled={saving}
                      onClick={() => void handleSelectSide(side.side.id)}
                      className={`group relative flex min-h-[28rem] items-end justify-center overflow-visible rounded-[2rem] border px-2 pb-4 pt-2 transition sm:min-h-[38rem] ${
                        isSelected
                          ? "border-white/10 bg-black/25"
                          : "border-white/10 bg-black/25 hover:border-amber-200/60 hover:bg-black/35"
                      } ${index === 0 ? "text-left" : "text-right"}`}
                    >
                      {isSelected ? (
                        <div className="pointer-events-none absolute inset-x-2 inset-y-0 rounded-[1.6rem] border-2 border-amber-200 bg-amber-200/10 shadow-[0_0_0_2px_rgba(255,224,138,0.38),0_0_40px_rgba(255,191,0,0.18)] sm:inset-x-3" />
                      ) : null}
                      {spriteUrl ? (
                        <div className="pointer-events-none absolute inset-x-[-4%] bottom-[1%] top-[1%] sm:bottom-[3%] sm:top-[-1%]">
                          <Image
                            src={spriteUrl}
                            alt={featuredEntrant?.name ?? side.displayName}
                            fill
                            unoptimized
                            sizes="(max-width: 640px) 45vw, 28vw"
                            className={`object-contain object-bottom pb-[30px] drop-shadow-[0_12px_30px_rgba(0,0,0,0.45)] scale-[1.28] sm:scale-[1.28] ${
                              index === 0 ? "scale-x-[-1]" : ""
                            }`}
                          />
                        </div>
                      ) : (
                        <div className="pointer-events-none absolute inset-x-2 bottom-16 top-6 rounded-[2rem] border border-dashed border-amber-200/25 bg-black/30" />
                      )}

                      <div className="pointer-events-none relative z-10 flex w-full justify-center">
                        <div className="absolute bottom-[-3.35rem] rounded-2xl border border-amber-200/20 bg-black/78 px-3 py-2 shadow-[0_14px_35px_rgba(0,0,0,0.32)]">
                          <p
                            className={`${vt323.className} text-center text-[1.55rem] uppercase leading-none tracking-[0.08em] text-amber-50`}
                          >
                            {side.displayName}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}

                <div className="pointer-events-none absolute inset-x-0 bottom-[7.5rem] z-20 flex items-center justify-center sm:bottom-[9.5rem]">
                  <div className="rounded-full border border-amber-200/20 bg-black/70 px-5 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
                    <p
                      className={`${pressStart2P.className} text-xs uppercase tracking-[0.22em] text-amber-100`}
                    >
                      VS
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-amber-200/20 bg-black/65 px-6 py-5 text-center shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
                <p
                  className={`${vt323.className} text-[2rem] uppercase tracking-[0.08em] text-amber-100`}
                >
                  {message ?? "This premium screen currently supports two-sided matches only."}
                </p>
              </div>
            )}
          </div>

          {message && scene && matchSides.length === 2 ? (
            <div className="mx-auto mb-4 w-full max-w-4xl rounded-2xl border border-amber-200/15 bg-black/65 px-4 py-3 text-center shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
              <p
                className={`${vt323.className} text-[1.55rem] uppercase tracking-[0.08em] text-amber-100`}
              >
                {message}
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
