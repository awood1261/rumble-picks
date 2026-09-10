export const DEFAULT_REVIEW_LINK_DURATION_DAYS = 14;

export type ShowReviewLinkRow = {
  id: string;
  show_id: string;
  promotion_id: string | null;
  token_hash: string;
  label: string | null;
  expires_at: string;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type ShowReviewLinkSummary = Omit<ShowReviewLinkRow, "token_hash">;

export type ShowReviewValidation =
  | {
      valid: true;
      showId: string;
      promotionId: string | null;
      label: string | null;
      expiresAt: string;
    }
  | {
      valid: false;
      reason: "missing" | "invalid" | "expired" | "revoked";
    };

export const buildReviewHref = (showHref: string, token: string) => {
  const separator = showHref.includes("?") ? "&" : "?";
  return `${showHref}${separator}review=${encodeURIComponent(token)}`;
};

export const getReviewLinkStatus = (
  link: Pick<ShowReviewLinkSummary, "expires_at" | "revoked_at">,
  now = Date.now()
) => {
  if (link.revoked_at) return "revoked";
  const expiresAt = new Date(link.expires_at).getTime();
  if (!Number.isNaN(expiresAt) && expiresAt <= now) return "expired";
  return "active";
};
