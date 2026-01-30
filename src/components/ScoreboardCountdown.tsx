"use client";

import { useEffect, useState } from "react";

type ScoreboardCountdownProps = {
  intervalMs: number;
  lastUpdateAt: number;
  tickerItems?: string[];
  className?: string;
};

export const ScoreboardCountdown = ({
  intervalMs,
  lastUpdateAt,
  tickerItems = [],
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
        Next update in <strong>{Math.ceil(countdownMs / 1000)}s</strong>
      </div>
      {tickerItems.length > 0 && (
        <div className="ticker mx-auto mt-2 w-full max-w-5xl overflow-hidden rounded-full border border-zinc-800 bg-black/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-200">
          <div className="ticker-track">
            <span className="ticker-items">
              {tickerItems.map((item, index) => (
                <span key={`${item}-${index}`} className="ticker-item">
                  {item}
                </span>
              ))}
            </span>
            <span className="ticker-items" aria-hidden="true">
              {tickerItems.map((item, index) => (
                <span key={`${item}-dup-${index}`} className="ticker-item">
                  {item}
                </span>
              ))}
            </span>
          </div>
        </div>
      )}
      <style jsx>{`
        .countdown-banner {
          background: linear-gradient(180deg, #fbc400 0%, #f2b200 100%);
        }
        .ticker-track {
          display: inline-flex;
          width: max-content;
          animation: tickerScroll 24s linear infinite;
        }
        .ticker-items {
          display: inline-flex;
          gap: 1.5rem;
          padding-right: 1.5rem;
        }
        .ticker-item {
          white-space: nowrap;
        }
        @keyframes tickerScroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
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
