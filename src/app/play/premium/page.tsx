"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PREMIUM_ROUTES } from "../../../lib/premiumMode";

const SPLASH_FADE_MS = 900;
const SPLASH_HOLD_MS = 5000;

type SplashPhase = "enter" | "visible" | "exit" | "title";

function PremiumSplashScreen({ phase }: { phase: SplashPhase }) {
  const isExiting = phase === "exit";
  const isVisible = phase === "visible" || phase === "exit";

  return (
    <div
      className="absolute inset-0 transition-opacity duration-[900ms]"
      style={{ opacity: isVisible ? 1 : 0 }}
    >
      <div className="relative min-h-screen bg-[radial-gradient(circle_at_center,_rgba(112,95,255,0.3)_0%,_rgba(62,46,182,0.2)_32%,_transparent_62%),radial-gradient(circle_at_top,_rgba(255,230,145,0.08),_transparent_25%),linear-gradient(180deg,_#3d2bd6_0%,_#4330ea_24%,_#3822c6_58%,_#2a1892_100%)]">
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:5px_5px,5px_5px]" />
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.16)_0.7px,transparent_0.7px)] [background-size:7px_7px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_48%,_rgba(20,10,80,0.32)_80%,_rgba(7,5,31,0.72)_100%)]" />

        <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-12 text-center">
          <div
            className={`w-full max-w-3xl transition-all duration-[900ms] ${
              isExiting
                ? "translate-y-3 scale-[0.985] opacity-0"
                : "translate-y-0 scale-100 opacity-100"
            }`}
          >
            <div className="mx-auto flex w-full flex-col items-center">
              <div className="relative mx-auto flex h-[20rem] w-[20rem] items-center justify-center sm:h-[25rem] sm:w-[25rem]">
                <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(255,213,93,0.4)_0%,_rgba(255,188,52,0.22)_38%,_transparent_66%)] blur-2xl" />
                <div className="absolute inset-[6%] rounded-full bg-[conic-gradient(from_0deg,_#ffcf52_0deg,_#f3a633_24deg,_#d2871d_38deg,_#ffcf52_52deg,_#f3a633_68deg,_#d2871d_82deg,_#ffcf52_96deg,_#f3a633_114deg,_#d2871d_128deg,_#ffcf52_142deg,_#f3a633_158deg,_#d2871d_172deg,_#ffcf52_186deg,_#f3a633_204deg,_#d2871d_218deg,_#ffcf52_232deg,_#f3a633_248deg,_#d2871d_262deg,_#ffcf52_276deg,_#f3a633_294deg,_#d2871d_308deg,_#ffcf52_322deg,_#f3a633_338deg,_#d2871d_352deg,_#ffcf52_360deg)] [clip-path:polygon(50%_0%,58%_8%,68%_2%,73%_12%,84%_7%,86%_19%,96%_17%,94%_29%,100%_37%,94%_45%,98%_56%,90%_61%,92%_73%,81%_74%,79%_86%,68%_82%,63%_94%,50%_88%,38%_96%,32%_84%,20%_88%,18%_76%,6%_79%,8%_67%,0%_59%,5%_48%,0%_38%,8%_31%,5%_20%,16%_17%,18%_6%,30%_11%,36%_2%,44%_8%)] opacity-95" />
                <div className="absolute inset-[14%] rounded-full border-[10px] border-[#f6b22f] bg-[#0c1d72] shadow-[0_0_0_5px_rgba(247,188,62,0.38)]" />
                <div className="absolute inset-[19%] rounded-full border-[4px] border-[#f6b22f] bg-[radial-gradient(circle_at_top,_rgba(73,111,255,0.28),_transparent_58%),linear-gradient(180deg,_#0d2c8e_0%,_#091b63_100%)]" />
                <div className="absolute left-1/2 top-1/2 h-[38%] w-[38%] -translate-x-1/2 -translate-y-[58%] rounded-full border-4 border-[#5d79b2] opacity-80" />
                <div className="absolute left-1/2 top-[31%] h-[2px] w-[34%] -translate-x-1/2 bg-[#5d79b2]/90" />
                <div className="absolute left-1/2 top-[39%] h-[2px] w-[36%] -translate-x-1/2 bg-[#5d79b2]/70" />
                <div className="absolute left-1/2 top-[47%] h-[2px] w-[34%] -translate-x-1/2 bg-[#5d79b2]/70" />
                <div className="absolute left-[33%] top-[31%] h-[18%] w-[2px] rotate-[18deg] bg-[#5d79b2]/75" />
                <div className="absolute left-[44%] top-[29%] h-[21%] w-[2px] rotate-[8deg] bg-[#5d79b2]/75" />
                <div className="absolute right-[44%] top-[29%] h-[21%] w-[2px] -rotate-[8deg] bg-[#5d79b2]/75" />
                <div className="absolute right-[33%] top-[31%] h-[18%] w-[2px] -rotate-[18deg] bg-[#5d79b2]/75" />
                <div className="absolute left-1/2 top-1/2 h-[18%] w-[38%] -translate-x-1/2 -translate-y-[8%] rounded-[0.9rem] border-[6px] border-[#5f6f98] bg-[#10255f] shadow-[0_10px_0_rgba(0,0,0,0.18)]">
                  <div className="absolute inset-x-[8%] top-[18%] h-[5px] rounded-full bg-[#d0d7ef]" />
                  <div className="absolute inset-x-[12%] top-[40%] h-[3px] rounded-full bg-[#ff5d34]" />
                  <div className="absolute inset-x-[12%] top-[55%] h-[3px] rounded-full bg-[#f4f6fb]" />
                  <div className="absolute inset-x-[12%] top-[70%] h-[3px] rounded-full bg-[#3aa3ff]" />
                  <div className="absolute left-[10%] top-[6%] h-[88%] w-[8%] rounded-full bg-[#50638e]" />
                  <div className="absolute right-[10%] top-[6%] h-[88%] w-[8%] rounded-full bg-[#50638e]" />
                </div>
                <div className="absolute bottom-[22%] left-1/2 h-[9%] w-[26%] -translate-x-1/2 rounded-[0.8rem] border-[4px] border-[#d4a431] bg-[linear-gradient(180deg,_#f9dd70_0%,_#c48b18_100%)] shadow-[0_0_0_2px_rgba(80,53,0,0.35)]" />
                <div className="absolute bottom-[22%] left-[26%] h-[24%] w-[11%] rounded-full border-[4px] border-[#7da148] border-t-0 border-r-0 bg-transparent opacity-90" />
                <div className="absolute bottom-[22%] right-[26%] h-[24%] w-[11%] rounded-full border-[4px] border-[#7da148] border-t-0 border-l-0 bg-transparent opacity-90" />
                <div className="absolute inset-[10%] rounded-full border border-[#ffd974]/40" />
              </div>

              <h1 className="mt-4 text-balance font-mono text-4xl font-black uppercase tracking-[0.08em] text-[#fff5d1] drop-shadow-[0_3px_0_rgba(53,29,123,0.8)] sm:text-6xl">
                "Wrestling Is For Everyone"
              </h1>
              <p className="mt-4 font-mono text-sm font-semibold uppercase tracking-[0.16em] text-[#fff3b7] sm:text-xl">
                Labor of Love GM Billy Avery
              </p>
              <div className="mx-auto mt-8 h-px w-4/5 max-w-xl bg-[linear-gradient(90deg,_transparent,_rgba(255,212,98,0.95),_transparent)] shadow-[0_0_20px_rgba(255,208,92,0.34)]" />
              <p className="mt-8 font-mono text-lg font-black uppercase tracking-[0.14em] text-[#ffe28d] sm:text-3xl">
                An Experience Powered by BoutPick
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function PremiumTitleCardScreen() {
  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,211,92,0.18),_transparent_24%),linear-gradient(180deg,_#0b0616_0%,_#190d28_55%,_#09050f_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:6px_6px,6px_6px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,_rgba(110,88,255,0.38),_transparent_62%)]" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl rounded-[2.4rem] border border-amber-300/20 bg-black/45 p-4 shadow-[0_0_0_1px_rgba(255,211,92,0.06),0_24px_90px_rgba(0,0,0,0.5)] backdrop-blur-sm sm:p-6">
          <div className="rounded-[2rem] border border-amber-300/15 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0)_20%),repeating-linear-gradient(90deg,_rgba(255,255,255,0.02)_0px,_rgba(255,255,255,0.02)_2px,_transparent_2px,_transparent_16px)] px-6 py-10 text-center sm:px-10 sm:py-14">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.45em] text-amber-200/80">
              Title Card
            </p>
            <h1 className="mt-6 bg-gradient-to-b from-amber-50 via-amber-100 to-amber-300 bg-clip-text font-mono text-4xl font-black uppercase tracking-[0.18em] text-transparent drop-shadow-[0_0_18px_rgba(255,208,92,0.2)] sm:text-6xl">
              THE EXHIBITION
            </h1>
            <p className="mx-auto mt-5 max-w-2xl font-mono text-sm uppercase tracking-[0.14em] text-amber-50/75 sm:text-base">
              Choose your path, conquer the card, and make every prediction count.
            </p>
            <div className="mx-auto mt-8 h-px w-full max-w-2xl bg-[linear-gradient(90deg,_transparent,_rgba(255,212,98,0.95),_transparent)] shadow-[0_0_20px_rgba(255,208,92,0.25)]" />
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={PREMIUM_ROUTES.picks}
                className="inline-flex h-12 items-center justify-center rounded-full border border-[#ffe28d]/60 bg-[#ffe28d] px-8 font-mono text-sm font-black uppercase tracking-[0.24em] text-[#28154f] transition hover:bg-[#fff0b8]"
              >
                Play
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PremiumPlayPage() {
  const [phase, setPhase] = useState<SplashPhase>("enter");

  useEffect(() => {
    const enterTimer = window.setTimeout(() => {
      setPhase("visible");
    }, 30);

    const exitTimer = window.setTimeout(() => {
      setPhase("exit");
    }, SPLASH_FADE_MS + SPLASH_HOLD_MS);

    const titleTimer = window.setTimeout(() => {
      setPhase("title");
    }, SPLASH_FADE_MS + SPLASH_HOLD_MS + SPLASH_FADE_MS);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(titleTimer);
    };
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-[#1b1488] text-amber-50">
      {phase === "title" ? (
        <PremiumTitleCardScreen />
      ) : (
        <PremiumSplashScreen phase={phase} />
      )}
    </div>
  );
}
