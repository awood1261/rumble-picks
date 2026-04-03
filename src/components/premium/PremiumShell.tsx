"use client";

import type { ReactNode } from "react";

type PremiumShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
};

export const PremiumShell = ({
  eyebrow = "Premium Mode",
  title,
  description,
  children,
}: PremiumShellProps) => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,211,92,0.16),_transparent_28%),linear-gradient(180deg,_#09040d_0%,_#14091b_45%,_#060608_100%)] text-amber-50">
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 pb-20 sm:px-8 sm:py-12">
      <div className="mx-auto w-full max-w-4xl rounded-[2rem] border border-amber-300/25 bg-black/45 p-6 shadow-[0_0_0_1px_rgba(255,211,92,0.08),0_22px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8">
        <div className="rounded-[1.5rem] border border-amber-300/15 bg-[linear-gradient(180deg,_rgba(255,255,255,0.03),_rgba(255,255,255,0)_22%),repeating-linear-gradient(90deg,_rgba(255,255,255,0.025)_0px,_rgba(255,255,255,0.025)_2px,_transparent_2px,_transparent_14px)] p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.42em] text-amber-200/80">
            {eyebrow}
          </p>
          <h1 className="mt-3 bg-gradient-to-b from-amber-50 via-amber-100 to-amber-300 bg-clip-text font-mono text-3xl font-bold uppercase tracking-[0.22em] text-transparent sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-amber-50/70 sm:text-base">
            {description}
          </p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </main>
  </div>
);
