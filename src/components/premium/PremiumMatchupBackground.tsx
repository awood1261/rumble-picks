"use client";

import Image from "next/image";
import { PREMIUM_MATCHUP_BACKGROUND_URL } from "../../lib/premiumMode";

type PremiumMatchupBackgroundProps = {
  className?: string;
};

export const PremiumMatchupBackground = ({
  className = "",
}: PremiumMatchupBackgroundProps) => (
  <div
    className={`pointer-events-none absolute inset-0 overflow-hidden bg-black ${className}`}
    aria-hidden="true"
  >
    <Image
      src={PREMIUM_MATCHUP_BACKGROUND_URL}
      alt=""
      fill
      priority
      sizes="100vw"
      unoptimized
      className="object-cover"
    />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_38%,_rgba(0,0,0,0.34)_72%,_rgba(0,0,0,0.72)_100%)]" />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(0,0,0,0.28)_0%,_rgba(0,0,0,0.08)_32%,_rgba(0,0,0,0.18)_70%,_rgba(0,0,0,0.55)_100%)]" />
  </div>
);
