"use client";

import Image from "next/image";
import { Press_Start_2P, VT323 } from "next/font/google";
import { useEffect, useState } from "react";

const SPLASH_FADE_MS = 900;
const SPLASH_HOLD_MS = 5000;
const PREMIUM_PROMOTION_PLACEHOLDER =
  "https://fqfufzrebrxubrechdal.supabase.co/storage/v1/object/public/8bit/lol-logo-pixelate.png";

const pressStart2P = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
});

const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
});

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

              <h1
                className={`${pressStart2P.className} mt-4 text-balance text-4xl font-black uppercase tracking-[0.08em] text-[#fff5d1] drop-shadow-[0_3px_0_rgba(53,29,123,0.8)] sm:text-6xl`}
              >
                &ldquo;Wrestling Is For Everyone&rdquo;
              </h1>
              <p
                className={`${vt323.className} mt-4 text-2xl font-normal uppercase tracking-[0.12em] text-[#fff3b7] sm:text-4xl`}
              >
                Labor of Love GM Billy Avery
              </p>
              <div className="mx-auto mt-8 h-px w-4/5 max-w-xl bg-[linear-gradient(90deg,_transparent,_rgba(255,212,98,0.95),_transparent)] shadow-[0_0_20px_rgba(255,208,92,0.34)]" />
              <p
                className={`${pressStart2P.className} mt-8 text-[10px] font-black uppercase tracking-[0.18em] text-[#ffe28d]/75 sm:text-sm`}
              >
                An Experience Powered by BoutPick
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function PremiumTitleCardScreen({
  onStart,
}: {
  onStart: () => void;
}) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="relative min-h-screen bg-black text-white">
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-full max-w-2xl">
          <div className="mx-auto flex justify-center">
            <div className="relative h-32 w-32 sm:h-40 sm:w-40">
              <Image
                src={PREMIUM_PROMOTION_PLACEHOLDER}
                alt="Promotion logo"
                fill
                sizes="(max-width: 640px) 128px, 160px"
                className="object-contain pixelated"
                priority
              />
            </div>
          </div>

          <div className="mt-8">
            <p
              className={`${pressStart2P.className} text-xl uppercase tracking-[0.14em] text-[#62d8ff] sm:text-2xl`}
            >
              The
            </p>
            <h1
              className={`${pressStart2P.className} mt-4 text-4xl uppercase leading-[1.3] tracking-[0.08em] text-[#f6d83f] [text-shadow:4px_0_0_#cf5b1e] sm:text-6xl`}
            >
              Exhibition
            </h1>
          </div>

          <div className="mt-14 flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={onStart}
              className={`${pressStart2P.className} inline-flex items-center justify-center text-base uppercase tracking-[0.18em] text-white transition hover:text-[#f6d83f] sm:text-lg`}
            >
              Play
            </button>
          </div>

          <div
            className={`${pressStart2P.className} mt-20 space-y-2 text-[10px] uppercase tracking-[0.16em] text-white sm:text-xs`}
          >
            <p>&copy;{currentYear} BoutPick</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export function PremiumIntroSequence({
  onComplete,
}: {
  onComplete: () => void;
}) {
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
        <PremiumTitleCardScreen onStart={onComplete} />
      ) : (
        <PremiumSplashScreen phase={phase} />
      )}
    </div>
  );
}
