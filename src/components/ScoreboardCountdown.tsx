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
        className={`mx-auto w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-zinc-300 shadow-lg shadow-black/30 ${
          pulse ? "animate-pulse text-amber-200" : ""
        }`}
      >
        Next update in {Math.ceil(countdownMs / 1000)}s
      </div>
    </div>
  );
};
