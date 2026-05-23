import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFeaturedTitlePromotionId, getTitleLandingPromotionCards } from "../../lib/championData";
import { avatarSrcForKey } from "../../lib/avatarOptions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabel = (status: "inaugural" | "defending" | "vacant") => {
  switch (status) {
    case "defending":
      return "Defending";
    case "vacant":
      return "Vacant";
    default:
      return "Inaugural";
  }
};

export default async function TitleLandingPage() {
  const featuredPromotionId = await getFeaturedTitlePromotionId();
  if (featuredPromotionId) {
    redirect(`/title/${featuredPromotionId}`);
  }

  const promotions = await getTitleLandingPromotionCards();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 pt-8">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-amber-200/80">
            BoutPick Hall of Champions
          </p>
          <h1 className="mt-3 text-3xl font-black uppercase tracking-[0.12em] text-amber-50 sm:text-4xl">
            Championship Lineage
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
            Explore the active title history for every promotion participating in
            BoutPick.
          </p>
        </header>

        {promotions.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 px-6 py-8 text-center text-sm text-zinc-300">
            No promotions are available right now.
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {promotions.map((promotion) => (
              <Link
                key={promotion.promotion_id}
                href={`/title/${promotion.promotion_id}`}
                className="group overflow-hidden rounded-[1.75rem] border border-zinc-800 bg-[linear-gradient(145deg,rgba(20,20,20,0.98),rgba(8,8,8,0.98))] p-5 transition hover:border-amber-400/40"
              >
                <div className="flex items-start gap-4">
                  {promotion.promotion_image_url ? (
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[1.1rem] bg-black/30">
                      <Image
                        src={promotion.promotion_image_url}
                        alt={promotion.promotion_name}
                        fill
                        sizes="80px"
                        className="object-contain p-2"
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <div className="inline-flex rounded-full border border-amber-300/18 bg-amber-300/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100">
                      {statusLabel(promotion.status)}
                    </div>
                    <h2 className="mt-3 text-xl font-black uppercase tracking-[0.06em] text-amber-50">
                      {promotion.promotion_name}
                    </h2>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-400">
                      {promotion.reign_count} reign{promotion.reign_count === 1 ? "" : "s"} ·{" "}
                      {promotion.total_defenses} total defense
                      {promotion.total_defenses === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-[1.25rem] border border-zinc-800 bg-black/20 p-4">
                  {promotion.reigning_champion_username ? (
                    <div className="flex items-center gap-3">
                      <Image
                        src={avatarSrcForKey(promotion.reigning_champion_avatar)}
                        alt={`${promotion.reigning_champion_username} avatar`}
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-xl border border-zinc-800 bg-zinc-900 object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                          Latest champion
                        </p>
                        <p className="mt-1 truncate text-lg font-semibold text-zinc-100">
                          {promotion.reigning_champion_username}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                        Title state
                      </p>
                      <p className="mt-1 text-sm text-zinc-300">
                        No reigning champion has been recorded yet.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200 transition group-hover:text-amber-100">
                  View lineage
                  <span>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
