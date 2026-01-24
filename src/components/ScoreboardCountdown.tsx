"use client";

import { useEffect, useState } from "react";

type ScoreboardCountdownProps = {
  intervalMs: number;
  lastUpdateAt: number;
  className?: string;
};

export const ScoreboardCountdown = ({
  intervalMs,
  lastUpdateAt,
  className,
}: ScoreboardCountdownProps) => {
  const [countdownMs, setCountdownMs] = useState(intervalMs);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setCountdownMs(Math.max(intervalMs - (Date.now() - lastUpdateAt), 0));
  }, [intervalMs, lastUpdateAt]);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastUpdateAt;
      const remaining = Math.max(intervalMs - elapsed, 0);
      setCountdownMs(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [intervalMs, lastUpdateAt]);

  useEffect(() => {
    setPulse(true);
    const timeout = setTimeout(() => setPulse(false), 900);
    return () => clearTimeout(timeout);
  }, [lastUpdateAt]);

  return (
    <div className={className}>
      <div
        className={`countdown-banner mx-auto w-full max-w-5xl border border-amber-500/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-black shadow-lg shadow-black/30 ${
          pulse ? "countdown-glow" : ""
        }`}
      >
        Next update in {Math.ceil(countdownMs / 1000)}s
      </div>
      <style jsx>{`
        .countdown-banner {
          background: linear-gradient(180deg, #fbc400 0%, #f2b200 100%);
        }
        .countdown-glow {
          animation: countdownGlow 1s ease-in-out;
        }
        @keyframes countdownGlow {
          0% {
            filter: brightness(1);
          }
          50% {
            filter: brightness(0.92);
          }
          100% {
            filter: brightness(1);
          }
        }
      `}</style>
    </div>
  );
};
