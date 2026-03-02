import type { Metadata } from "next";

type LayoutProps = {
  children: React.ReactNode;
  params: { showId: string; promotionId: string };
};

type ShowRow = {
  id: string;
  name: string;
  tagline?: string | null;
  image_url: string | null;
  promotion_id: string | null;
};

type PromotionRow = {
  id: string;
  name: string;
};

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL || "https://boutpick.com";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

const fetchShow = async (showId: string) => {
  if (!supabaseUrl || !supabaseKey || !showId) return null;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/shows?select=id,name,tagline,image_url,promotion_id&id=eq.${showId}`,
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

const fetchPromotion = async (promotionId: string | null) => {
  if (!supabaseUrl || !supabaseKey || !promotionId) return null;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/promotions?select=id,name&id=eq.${promotionId}`,
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
  const show = await fetchShow(params.showId);
  const promotion = await fetchPromotion(show?.promotion_id ?? null);
  const title = show
    ? `${show.name}${promotion ? ` · ${promotion.name}` : ""}`
    : "BoutPick";
  const description =
    show?.tagline ||
    (show ? `Make picks for ${show.name} on BoutPick.` : "BoutPick.");
  const imageUrl = show?.image_url || "/images/og-default.svg";
  const baseUrl = getBaseUrl();

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${baseUrl}/shows/${params.promotionId}/${params.showId}`,
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
