"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ScoreboardCountdownProps = {
  intervalMs: number;
  lastUpdateAt: number;
  tickerItems?: string[];
  onTickerClick?: () => void;
  className?: string;
};

export const ScoreboardCountdown = ({
  intervalMs,
  lastUpdateAt,
  tickerItems = [],
  onTickerClick,
  className,
}: ScoreboardCountdownProps) => {
  const [countdownMs, setCountdownMs] = useState(intervalMs);
  const [pulse, setPulse] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const update = () => {
      const layoutHeight = document.documentElement.clientHeight;
      const visualHeight = window.innerHeight;
      const offset = Math.max(0, visualHeight - layoutHeight);
      setBottomOffset(Math.max(0, offset - 6));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update);
    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener("resize", update);
      viewport.addEventListener("scroll", update);
    }
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      if (viewport) {
        viewport.removeEventListener("resize", update);
        viewport.removeEventListener("scroll", update);
      }
    };
  }, [mounted]);

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

  if (!mounted) return null;

  const content = (
    <div
      className={["scoreboard-fixed", className].filter(Boolean).join(" ")}
      style={{ transform: `translate3d(0, ${bottomOffset}px, 0)` }}
    >
      <div className="mx-auto w-full max-w-5xl">
        <div
          className={`countdown-banner w-full border border-amber-500/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-black shadow-lg shadow-black/30 ${
            pulse ? "countdown-glow" : ""
          }`}
        >
          Next update in <strong>{Math.ceil(countdownMs / 1000)}s</strong>
        </div>
        {tickerItems.length > 0 && (
          <button
            className="ticker mt-2 w-full overflow-hidden rounded-full border border-zinc-800 bg-black/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-200 transition hover:border-amber-300"
            type="button"
            onClick={onTickerClick}
          >
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
          </button>
        )}
      </div>
      <style jsx>{`
        .countdown-banner {
          background: linear-gradient(180deg, #fbc400 0%, #f2b200 100%);
        }
        .scoreboard-fixed {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 40;
          padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 4px);
          backface-visibility: hidden;
          will-change: transform;
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

  return createPortal(content, document.body);
};
