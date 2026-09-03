import Image from "next/image";
import Link from "next/link";
import { Cinzel } from "next/font/google";
import { avatarSrcForKey } from "../../../lib/avatarOptions";
import { getPromotionLineagePageData } from "../../../lib/championData";
import {
  buildPromotionShowsHref,
  buildShowHref,
} from "../../../lib/friendlyUrls";

export const revalidate = 300;

const BOUTPICK_TITLE_URL =
  "https://fqfufzrebrxubrechdal.supabase.co/storage/v1/object/public/belts/boutpick/bout-pick-prediction-title.png";
const BOUTPICK_TITLE_HERO_BG_URL =
  "https://fqfufzrebrxubrechdal.supabase.co/storage/v1/object/public/belts/boutpick/hero-bg.png";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const formatWonDate = (value: string | null) => {
  if (!value) return "Date TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBD";
  return date.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
};

const durationInDays = (wonAt: string | null, endedAt: string | null) => {
  if (!wonAt) return null;
  const start = new Date(wonAt).getTime();
  if (Number.isNaN(start)) return null;
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (Number.isNaN(end)) return null;
  return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
};

const formatDuration = (wonAt: string | null, endedAt: string | null) => {
  const days = durationInDays(wonAt, endedAt);
  if (!days) {
    return {
      value: "TBD",
      label: "Days held",
    };
  }
  return {
    value: String(days),
    label: "Days held",
  };
};

type TitleLineagePageProps = {
  params: Promise<{ promotionId: string }>;
};

export default async function TitleLineagePage({
  params,
}: TitleLineagePageProps) {
  const { promotionId } = await params;
  const pageData = await getPromotionLineagePageData(promotionId);
  const promotion = pageData.promotion;
  const status = pageData.status;
  const currentReign = pageData.lineage[0] ?? null;
  const promotionShowsHref = promotion
    ? buildPromotionShowsHref(promotion)
    : `/shows/${promotionId}`;
  const playHref = pageData.call_to_action_show_id
    ? buildShowHref(
        {
          id: pageData.call_to_action_show_id,
          slug: pageData.call_to_action_show_slug,
          promotion_id: promotion?.id ?? promotionId,
        },
        promotion
      )
    : promotionShowsHref;

  if (!promotion) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="mx-auto w-full max-w-4xl px-6 py-10">
          <Link
            href="/shows"
            className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200 hover:text-amber-100"
          >
            ← Back to promotions
          </Link>
          <p className="mt-8 text-sm text-zinc-400">Promotion not found.</p>
        </main>
      </div>
    );
  }

  const uniqueChampionCount = new Set(
    pageData.lineage.map((reign) =>
      reign.champion_user_id
        ? `user:${reign.champion_user_id}`
        : `name:${reign.champion_username.toLowerCase()}`,
    ),
  ).size;
  const totalDefenses = pageData.lineage.reduce(
    (sum, reign) => sum + reign.successful_defenses,
    0,
  );
  const currentDaysHeld = currentReign
    ? durationInDays(currentReign.won_at, currentReign.ended_at)
    : null;
  const statCards = [
    {
      icon: "⌛",
      value: currentDaysHeld ? String(currentDaysHeld) : "0",
      label: "Days held",
    },
    {
      icon: "🛡️",
      value: String(status.successful_defenses ?? 0),
      label: "Defenses",
    },
    {
      icon: "👑",
      value: String(pageData.lineage.length),
      label: "Reigns",
    },
    {
      icon: "🏅",
      value: String(uniqueChampionCount),
      label: "Champions",
    },
    {
      icon: "⚔️",
      value: String(totalDefenses),
      label: "Total defenses",
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#060606] text-zinc-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(77,163,255,0.10),transparent_25%),radial-gradient(circle_at_top_right,rgba(255,214,122,0.12),transparent_30%),linear-gradient(180deg,#0a0a0a_0%,#050505_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%,rgba(0,0,0,0.25)_100%)]" />
      <main className="relative mx-auto w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Link
            href={promotionShowsHref}
            className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200 hover:text-amber-100"
          >
            ← Back to Shows
          </Link>
        </div>

        <div className="mb-5 text-center">
          <h1
            className={`${cinzel.className} mt-2 text-2xl font-semibold uppercase tracking-[0.14em] text-amber-50 drop-shadow-[0_2px_18px_rgba(255,214,122,0.12)] sm:text-3xl`}
          >
            Championship Lineage
          </h1>
          <div className="mx-auto mt-3 h-px w-32 bg-gradient-to-r from-transparent via-amber-300/55 to-transparent" />
        </div>

        <section
          data-component="TitleHero"
          className="relative overflow-hidden rounded-[1.85rem] border border-zinc-800/80 bg-[linear-gradient(145deg,rgba(15,18,22,0.96),rgba(8,8,8,0.98))] shadow-[0_32px_90px_rgba(0,0,0,0.55)] sm:border-amber-300/12"
        >
          <Image
            src={BOUTPICK_TITLE_HERO_BG_URL}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 80rem, 100vw"
            className="object-cover object-center opacity-45"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,0.84)_0%,rgba(8,8,8,0.72)_34%,rgba(6,6,6,0.36)_68%,rgba(5,5,5,0.6)_100%)]" />
          <div className="relative flex flex-nowrap items-center gap-2 px-3 py-1.5 sm:gap-4 sm:px-5 sm:py-4 lg:px-6 lg:py-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,214,122,0.09),transparent_32%),radial-gradient(circle_at_60%_0%,rgba(80,150,255,0.10),transparent_28%)]" />

            <div className="relative z-20 basis-[50%] w-[50%] min-w-0 shrink-0">
              <div className="flex flex-col items-start">
                {promotion.image_url ? (
                  <div className="relative right-0 flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-[0.8rem] bg-black/10 sm:w-full sm:max-w-[10rem] sm:rounded-[1.4rem]">
                    <Image
                      src={promotion.image_url}
                      alt={`${promotion.name} logo`}
                      width={220}
                      height={220}
                      sizes="(min-width: 640px) 160px, 92px"
                      className="block h-auto w-full object-contain p-2 sm:p-3"
                    />
                  </div>
                ) : null}
                <div className="mt-2 min-w-0">
                  <h1 className=" text-[0.92rem] font-black uppercase leading-[0.92] text-amber-50 sm:max-w-none sm:text-4xl">
                    {promotion.name}
                  </h1>
                  <p className="mt-1.5 max-w-[98px] text-[8px] leading-3.5 text-zinc-300 sm:mt-3 sm:max-w-sm sm:text-sm sm:leading-6">
                    Every reign and defense.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative z-0 min-w-0 flex-1">
              <div className="relative flex min-h-[120px] items-center justify-center overflow-visible sm:min-h-[180px]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,214,122,0.16),transparent_42%),radial-gradient(circle_at_top,rgba(90,160,255,0.10),transparent_36%)]" />
                <Image
                  src={BOUTPICK_TITLE_URL}
                  alt="BoutPick title"
                  width={1400}
                  height={980}
                  priority
                  className="relative z-0 block h-auto w-[320px] max-w-none translate-x-0 drop-shadow-[0_28px_48px_rgba(0,0,0,0.72)] sm:w-[112%] sm:-translate-x-[4%] lg:w-[110%] lg:-translate-x-[3%]"
                />
              </div>
            </div>
          </div>
        </section>

        <section
          data-component="StatCards"
          className="mt-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-[44rem] flex-nowrap gap-[1px] overflow-hidden rounded-[1.3rem] border border-zinc-800/80 bg-zinc-800/80 sm:border-amber-300/10 sm:bg-[linear-gradient(180deg,rgba(80,60,28,0.16),rgba(28,24,18,0.12))]">
            {statCards.map((stat) => (
              <div
                key={stat.label}
                className="min-w-0 flex-1 bg-[linear-gradient(180deg,rgba(14,16,18,0.98),rgba(8,8,8,0.98))] sm:px-4 sm:py-4 px-1 py-1 text-center"
              >
                <div className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300/16 bg-amber-300/8 text-sm text-amber-100">
                  {stat.icon}
                </div>
                <p className="mt-0 text-2xl font-black text-amber-50">
                  {stat.value}
                </p>
                <p className="mt-0 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          data-component="CurrentChampion"
          className="grid gap-2 py-2 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"
        >
          {status.champion_username ? (
            <div className="rounded-[1.35rem] border border-zinc-800/80 bg-[linear-gradient(145deg,rgba(15,28,21,0.88),rgba(8,11,9,0.98))] p-4 sm:border-emerald-300/16">
              <div className="flex items-center gap-3">
                <Image
                  src={avatarSrcForKey(status.champion_avatar)}
                  alt={`${status.champion_username} avatar`}
                  width={96}
                  height={96}
                  className="h-24 w-24 rounded-2xl border border-zinc-800/80 bg-zinc-900 object-cover sm:border-amber-200/14"
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
                    Current champ
                  </p>
                  <h2 className="mt-2 truncate text-xl font-black leading-none text-amber-50">
                    {status.champion_username}
                  </h2>
                  <span className="mt-1 text-xs tracking-tighter font-semibold uppercase text-zinc-500">
                    05/02/26 - PRESENT
                  </span>
                </div>
                <div className="shrink-0 space-y-1 text-right uppercase text-[12px] tracking-[0.08em] text-zinc-400">
                  <div className="whitespace-nowrap">
                    <span className="font-semibold tabular-nums text-emerald-200">
                      {currentDaysHeld ?? 0}
                    </span>{" "}
                    <span>Days held</span>
                  </div>
                  <div className="whitespace-nowrap">
                    <span className="font-semibold tabular-nums text-emerald-200">
                      {status.successful_defenses ?? 0}
                    </span>{" "}
                    <span>Defenses</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.35rem] border border-dashed border-amber-300/14 bg-black/18 px-5 py-6 text-sm text-zinc-400">
              No champion is recorded yet.
            </div>
          )}
        </section>

        <section
          data-component="play-cta"
          className="mt-2 rounded-[1.5rem] border border-zinc-800/80 bg-[linear-gradient(145deg,rgba(32,26,18,0.98),rgba(13,12,10,0.98))] px-5 py-5 shadow-[0_0_32px_rgba(255,196,90,0.12)] sm:border-amber-400/20"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/18 bg-amber-300/10 text-lg text-amber-100">
                🏆
              </span>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.08em] text-amber-50">
                  Think you can take the title?
                </p>
                <p className="mt-1 text-sm text-zinc-300">
                  Join the next show and make your predictions.
                </p>
              </div>
            </div>
            <Link
              href={playHref}
              className="inline-flex items-center justify-center rounded-xl border border-amber-200/20 bg-amber-300 px-6 py-3 text-sm font-black uppercase tracking-[0.18em] text-black transition hover:bg-amber-200"
            >
              Play
            </Link>
          </div>
        </section>

        <section data-component="TitleLineage" className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <h2 className="text-xl font-black uppercase tracking-[0.08em] text-amber-50">
              Lineage Timeline
            </h2>
          </div>

          {pageData.lineage.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-amber-300/18 bg-black/20 px-6 py-8 text-sm text-zinc-300">
              No champions have been crowned for this promotion yet.
            </div>
          ) : (
            <div className="space-y-3">
              {pageData.lineage.map((reign) => (
                <div
                  key={`${reign.won_show_id}-${reign.lineage_number}`}
                  className="relative overflow-hidden px-0 py-1"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-300/20 bg-black/20 text-sm font-black text-amber-50">
                        {reign.lineage_number}
                      </div>
                      <Image
                        src={avatarSrcForKey(reign.champion_avatar)}
                        alt={`${reign.champion_username} avatar`}
                        width={72}
                        height={72}
                        className="h-[72px] w-[72px] rounded-2xl border border-zinc-800/80 bg-zinc-900 object-cover sm:border-amber-200/14"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-black text-amber-50">
                            {reign.champion_username}
                          </h3>
                          {reign.is_current ? (
                            <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                              Current
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0 text-sm text-zinc-300">
                          {reign.won_show_name}
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-tighter text-zinc-500">
                          {formatWonDate(reign.won_at)}
                          {reign.ended_at
                            ? ` - ${formatWonDate(reign.ended_at)}`
                            : " - Present"}
                        </p>
                      </div>
                    </div>
                    <div className="ml-auto shrink-0 text-right text-xs uppercase tracking-tighter text-zinc-400">
                      <div><span className="text-emerald-200">{reign.successful_defenses}</span> Defenses</div>
                      <div>
                        <span className="text-emerald-200">
                          {formatDuration(reign.won_at, reign.ended_at).value}
                        </span>{" "}
                        {formatDuration(reign.won_at, reign.ended_at).label}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
