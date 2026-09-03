const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PromotionLike = {
  id: string;
  slug?: string | null;
};

type ShowLike = {
  id: string;
  promotion_id?: string | null;
  slug?: string | null;
};

export const isUuid = (value: string) => UUID_PATTERN.test(value);

export const normalizeSlug = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const isValidSlug = (value: string) =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export const buildPromotionShowsHref = (promotion: PromotionLike) => {
  return `/shows/${promotion.slug || promotion.id}`;
};

export const buildShowHref = (
  show: ShowLike,
  promotion?: PromotionLike | null
) => {
  const promotionIdentifier = promotion?.slug || show.promotion_id;
  if (!promotionIdentifier) return "/shows";
  return `/shows/${promotionIdentifier}/${show.slug || show.id}`;
};
