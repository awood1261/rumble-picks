"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PremiumShell } from "../../../components/premium/PremiumShell";

export default function PremiumPicksPage() {
  const searchParams = useSearchParams();
  const showId = searchParams.get("show");

  return (
    <PremiumShell
      eyebrow="Premium Picks"
      title="Retro Map Hub"
      description="This route is the dedicated premium picks entry point. In Phase 0 it exists to lock in route structure and interaction direction before the map, sprites, and node navigation are built."
    >
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[1.5rem] border border-amber-300/15 bg-black/40 p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-amber-200/80">
            Phase 0 Decisions In Code
          </p>
          <ul className="mt-4 space-y-3 text-sm text-amber-50/75">
            <li>Premium picks stay on a separate route tree.</li>
            <li>The future premium map will be driven by the existing step model.</li>
            <li>Premium mode will keep the current picks payload and scoring.</li>
            <li>Sprite-based match scenes will replace the current photo cards later.</li>
          </ul>
          <div className="mt-6 rounded-[1.25rem] border border-amber-300/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0)_100%)] p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-amber-200/80">
              Show Context
            </p>
            <p className="mt-3 text-sm text-amber-50/75">
              {showId
                ? `Premium picks requested for show ${showId}.`
                : "No show selected yet. Future map loading will use the same show query handling as standard picks."}
            </p>
          </div>
        </section>
        <aside className="rounded-[1.5rem] border border-amber-300/15 bg-black/40 p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-amber-200/80">
            Next Build Target
          </p>
          <p className="mt-4 text-sm text-amber-50/75">
            The next concrete step is replacing this placeholder with a node map
            generated from the same ordered picks flow the standard page already
            uses.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={showId ? `/picks?show=${showId}` : "/picks"}
              className="inline-flex h-11 items-center justify-center rounded-full border border-amber-300/35 bg-black/40 px-5 font-mono text-xs font-bold uppercase tracking-[0.22em] text-amber-100 transition hover:border-amber-200/60 hover:text-amber-50"
            >
              Open Standard Picks
            </Link>
            <Link
              href="/play/premium"
              className="inline-flex h-11 items-center justify-center rounded-full border border-amber-300/35 bg-black/40 px-5 font-mono text-xs font-bold uppercase tracking-[0.22em] text-amber-100 transition hover:border-amber-200/60 hover:text-amber-50"
            >
              Back To Premium Entry
            </Link>
          </div>
        </aside>
      </div>
    </PremiumShell>
  );
}
