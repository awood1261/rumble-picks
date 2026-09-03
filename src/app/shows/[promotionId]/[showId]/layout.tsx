import type { Metadata } from "next";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ showId: string; promotionId: string }>;
};

type ShowRow = {
  id: string;
  name: string;
  slug?: string | null;
  tagline?: string | null;
  image_url: string | null;
  promotion_id: string | null;
};

type PromotionRow = {
  id: string;
  name: string;
  slug?: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

const isUuid = (value: string) => UUID_PATTERN.test(value);

const buildShowHref = (
  show: Pick<ShowRow, "id" | "promotion_id" | "slug">,
  promotion?: Pick<PromotionRow, "id" | "slug"> | null
) => {
  const promotionIdentifier = promotion?.slug || show.promotion_id;
  if (!promotionIdentifier) return "/shows";
  return `/shows/${promotionIdentifier}/${show.slug || show.id}`;
};

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL || "https://boutpick.com";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

const fetchShow = async (showIdentifier: string, promotionId: string) => {
  if (!supabaseUrl || !supabaseKey || !showIdentifier || !promotionId) return null;
  const filter = isUuid(showIdentifier)
    ? `id=eq.${showIdentifier}`
    : `slug=eq.${encodeURIComponent(showIdentifier)}`;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/shows?select=id,name,slug,tagline,image_url,promotion_id&promotion_id=eq.${promotionId}&${filter}`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      next: { revalidate: 300 },
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as ShowRow[];
  return data[0] ?? null;
};

const fetchPromotion = async (promotionIdentifier: string | null) => {
  if (!supabaseUrl || !supabaseKey || !promotionIdentifier) return null;
  const filter = isUuid(promotionIdentifier)
    ? `id=eq.${promotionIdentifier}`
    : `slug=eq.${encodeURIComponent(promotionIdentifier)}`;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/promotions?select=id,name,slug&${filter}`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      next: { revalidate: 300 },
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as PromotionRow[];
  return data[0] ?? null;
};

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const resolvedParams = await params;
  const promotion = await fetchPromotion(resolvedParams.promotionId);
  const show = promotion
    ? await fetchShow(resolvedParams.showId, promotion.id)
    : null;
  const title = show
    ? `${show.name}${promotion ? ` · ${promotion.name}` : ""}`
    : "BoutPick";
  const description =
    show?.tagline ||
    (show ? `Make picks for ${show.name} on BoutPick.` : "BoutPick.");
  const imageUrl = show?.image_url || "/images/og-default.svg";
  const baseUrl = getBaseUrl();
  const showUrl = show
    ? `${baseUrl}${buildShowHref(show, promotion)}`
    : `${baseUrl}/shows/${resolvedParams.promotionId}/${resolvedParams.showId}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: showUrl,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function ShowDetailLayout({ children }: LayoutProps) {
  return children;
}
