"use client";

import Link from "next/link";
import { Press_Start_2P, VT323 } from "next/font/google";
import { useParams, useSearchParams } from "next/navigation";
import { PremiumMatchupBackground } from "../../../../../components/premium/PremiumMatchupBackground";
import { PREMIUM_DEMO_NODES } from "../../../../../lib/premiumMapNodes";

const pressStart2P = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
});

const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
});

export default function PremiumNodePage() {
  const params = useParams<{ nodeId: string }>();
  const searchParams = useSearchParams();
  const showId = searchParams.get("show");
  const nodeId = params.nodeId;
  const node = PREMIUM_DEMO_NODES.find((entry) => entry.id === nodeId) ?? null;
  const backHref = showId ? `/picks/premium?show=${showId}` : "/picks/premium";

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
            <p className={`${pressStart2P.className} text-[10px] uppercase tracking-[0.18em] text-amber-200/80`}>
              Premium Screen
            </p>
            <p className={`${vt323.className} mt-2 text-2xl uppercase tracking-[0.08em] text-amber-50/85`}>
              {node?.title ?? "Unknown Node"}
            </p>
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          <div className="grid w-full max-w-6xl grid-cols-[1fr_minmax(12rem,18rem)_1fr] items-end gap-3 sm:gap-6">
            <div className="flex min-h-[18rem] items-end justify-center">
              <div className="h-[20rem] w-full max-w-[16rem] rounded-[2rem] border border-amber-200/15 bg-[linear-gradient(180deg,_rgba(255,255,255,0.08),_rgba(255,255,255,0)_35%),linear-gradient(180deg,_rgba(0,0,0,0.02),_rgba(0,0,0,0.3)_100%)] shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-[1px] sm:h-[26rem] sm:max-w-[19rem]" />
            </div>

            <div className="mb-6 flex flex-col items-center justify-end gap-4">
              <div className="rounded-[1.6rem] border border-amber-200/20 bg-black/55 px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.3)]">
                <p className={`${pressStart2P.className} text-[10px] uppercase tracking-[0.18em] text-amber-200/75`}>
                  {node?.type === "question" ? "Question" : "Matchup"}
                </p>
                <p className={`${vt323.className} mt-2 text-[2rem] uppercase tracking-[0.08em] text-white`}>
                  {node?.title ?? "Node"}
                </p>
              </div>
              <div className="rounded-full border border-amber-200/25 bg-black/60 px-4 py-2">
                <p className={`${vt323.className} text-[1.5rem] uppercase tracking-[0.08em] text-amber-100/80`}>
                  Character sprites and prediction controls go here next.
                </p>
              </div>
            </div>

            <div className="flex min-h-[18rem] items-end justify-center">
              <div className="h-[20rem] w-full max-w-[16rem] rounded-[2rem] border border-amber-200/15 bg-[linear-gradient(180deg,_rgba(255,255,255,0.08),_rgba(255,255,255,0)_35%),linear-gradient(180deg,_rgba(0,0,0,0.02),_rgba(0,0,0,0.3)_100%)] shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-[1px] sm:h-[26rem] sm:max-w-[19rem]" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
