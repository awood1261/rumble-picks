import { NextResponse } from "next/server";

import { supabaseAdmin } from "./supabaseAdmin";

export type PromotionAccessContext = {
  userId: string;
  isSuperAdmin: boolean;
};

export type PromotionAccessResult =
  | { ok: true; context: PromotionAccessContext }
  | { ok: false; response: NextResponse };

type PromotionScopedShow = {
  id: string;
  promotion_id: string | null;
  slug?: string | null;
  promotions?: { id: string; slug?: string | null } | { id: string; slug?: string | null }[] | null;
};

const getBearerToken = (request: Request) => {
  const value = request.headers.get("authorization") ?? "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
};

export const requireAuthenticatedUser = async (
  request: Request
): Promise<PromotionAccessResult> => {
  const bearerToken = getBearerToken(request);
  if (!bearerToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(bearerToken);

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      response: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  return {
    ok: true,
    context: {
      userId: user.id,
      isSuperAdmin: Boolean(profile?.is_admin),
    },
  };
};

export const canManagePromotion = async (
  context: PromotionAccessContext,
  promotionId: string | null | undefined
) => {
  if (context.isSuperAdmin) return true;
  if (!promotionId) return false;

  const { data, error } = await supabaseAdmin
    .from("promotion_members")
    .select("id")
    .eq("promotion_id", promotionId)
    .eq("user_id", context.userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
};

export const requirePromotionManagement = async (
  request: Request,
  promotionId: string | null | undefined
): Promise<PromotionAccessResult> => {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;

  const allowed = await canManagePromotion(auth.context, promotionId);
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Promotion access required." }, { status: 403 }),
    };
  }

  return auth;
};

export const getShowForPromotionManagement = async (
  request: Request,
  showId: string
): Promise<
  | { ok: true; context: PromotionAccessContext; show: PromotionScopedShow }
  | { ok: false; response: NextResponse }
> => {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth;

  const { data: show, error } = await supabaseAdmin
    .from("shows")
    .select("id, slug, promotion_id, promotions:promotion_id(id, slug)")
    .eq("id", showId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }
  if (!show) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Show not found." }, { status: 404 }),
    };
  }

  const allowed = await canManagePromotion(auth.context, show.promotion_id);
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Promotion access required." }, { status: 403 }),
    };
  }

  return { ok: true, context: auth.context, show };
};
