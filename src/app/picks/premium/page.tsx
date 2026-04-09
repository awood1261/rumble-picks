"use client";

import Image from "next/image";
import Link from "next/link";
import { Press_Start_2P, VT323 } from "next/font/google";
import { useSearchParams } from "next/navigation";
import { PREMIUM_DEMO_NODES, type PremiumDemoNode } from "../../../lib/premiumMapNodes";

const pressStart2P = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
});

const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
});

const MAP_ART =
  "https://fqfufzrebrxubrechdal.supabase.co/storage/v1/object/public/8bit/canvasmap.png";
const statusClass = (status: PremiumDemoNode["status"]) => {
  if (status === "answered") {
    return "border-emerald-300/80 bg-emerald-300/10 shadow-[0_0_0_1px_rgba(110,231,183,0.2)]";
  }
  if (status === "active") {
    return "border-amber-200 bg-amber-200/18 shadow-[0_0_0_2px_rgba(255,224,138,0.4),0_0_34px_rgba(255,191,0,0.22)]";
  }
  return "border-white/15 bg-black/5 hover:border-amber-200/70 hover:bg-amber-200/8";
};

export default function PremiumPicksPage() {
  const searchParams = useSearchParams();
  const showId = searchParams.get("show");

  return (
    <div className="min-h-screen bg-black text-amber-50">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <h1
          className={`${pressStart2P.className} text-center text-lg uppercase tracking-[0.3em] text-amber-100 sm:text-2xl`}
        >
          Map
        </h1>
        <div className="mt-5 flex flex-1 items-center justify-center">
          <div className="relative aspect-[9/16] w-full max-w-[28rem] overflow-hidden rounded-[1.25rem] border border-amber-200/10 bg-black sm:max-w-[32rem]">
            <Image
              src={MAP_ART}
              alt="Retro gallery map"
              fill
              priority
              sizes="(max-width: 640px) 100vw, 32rem"
              className="object-contain"
            />
            {PREMIUM_DEMO_NODES.map((node) => {
              const href = showId
                ? `/picks/premium/node/${node.id}?show=${showId}`
                : `/picks/premium/node/${node.id}`;
              return (
                <Link
                  key={node.id}
                  href={href}
                  className={`absolute rounded-[0.9rem] border-2 transition-all duration-200 ${statusClass(
                    node.status,
                  )}`}
                  style={{
                    left: `${node.left}%`,
                    top: `${node.top}%`,
                    width: `${node.width}%`,
                    height: `${node.height}%`,
                  }}
                  aria-label={`Open ${node.title}`}
                >
                  <span className="sr-only">{node.title}</span>
                  {node.status === "answered" ? (
                    <span
                      className={`${pressStart2P.className} absolute right-2 top-2 rounded-full border border-emerald-300/70 bg-black/80 px-1.5 py-1 text-[8px] uppercase text-emerald-200`}
                    >
                      Done
                    </span>
                  ) : null}
                  <span
                    className={`${vt323.className} absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-black/80 px-2 py-1 text-xl uppercase tracking-[0.08em] text-amber-100`}
                  >
                    {node.title}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
