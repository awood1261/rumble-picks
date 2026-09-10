import { NextResponse } from "next/server";

import { buildShowHref } from "../../../lib/friendlyUrls";
import {
  DEFAULT_REVIEW_LINK_DURATION_DAYS,
  buildReviewHref,
  type ShowReviewLinkSummary,
} from "../../../lib/showReviewLinks";
import { createReviewToken, hashReviewToken } from "../../../lib/showReviewTokens";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type AdminContext =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

const getBearerToken = (request: Request) => {
  const value = request.headers.get("authorization") ?? "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
};

const requireAdmin = async (request: Request): Promise<AdminContext> => {
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

  if (profileError || !profile?.is_admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id };
};

const sanitizeLink = (link: ShowReviewLinkSummary) => link;

const defaultExpiresAt = () => {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_REVIEW_LINK_DURATION_DAYS);
  return date.toISOString();
};

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(request.url);
    const showId = searchParams.get("showId")?.trim() ?? "";
    if (!showId) {
      return NextResponse.json({ error: "Show is required." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("show_review_links")
      .select("id, show_id, promotion_id, label, expires_at, revoked_at, created_by, created_at")
      .eq("show_id", showId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ links: (data ?? []).map(sanitizeLink) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load review links.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const body = (await request.json()) as {
      showId?: string;
      label?: string;
      expiresAt?: string;
    };
    const showId = body.showId?.trim() ?? "";
    if (!showId) {
      return NextResponse.json({ error: "Show is required." }, { status: 400 });
    }

    const expiresAt = body.expiresAt?.trim() || defaultExpiresAt();
    const expiresTime = new Date(expiresAt).getTime();
    if (Number.isNaN(expiresTime) || expiresTime <= Date.now()) {
      return NextResponse.json(
        { error: "Expiration must be a future date." },
        { status: 400 }
      );
    }

    const { data: show, error: showError } = await supabaseAdmin
      .from("shows")
      .select("id, slug, promotion_id, promotions:promotion_id(id, slug)")
      .eq("id", showId)
      .maybeSingle();

    if (showError) {
      return NextResponse.json({ error: showError.message }, { status: 500 });
    }
    if (!show) {
      return NextResponse.json({ error: "Show not found." }, { status: 404 });
    }

    const token = createReviewToken();
    const tokenHash = hashReviewToken(token);
    const promotion = Array.isArray(show.promotions)
      ? show.promotions[0]
      : show.promotions;
    const showHref = buildShowHref(
      {
        id: show.id,
        slug: show.slug,
        promotion_id: show.promotion_id,
      },
      promotion
        ? {
            id: promotion.id,
            slug: promotion.slug,
          }
        : null
    );

    const { data: link, error: insertError } = await supabaseAdmin
      .from("show_review_links")
      .insert({
        show_id: show.id,
        promotion_id: show.promotion_id,
        token_hash: tokenHash,
        label: body.label?.trim() || null,
        expires_at: new Date(expiresAt).toISOString(),
        created_by: admin.userId,
      })
      .select("id, show_id, promotion_id, label, expires_at, revoked_at, created_by, created_at")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      link: sanitizeLink(link),
      reviewPath: buildReviewHref(showHref, token),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create review link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;

    const body = (await request.json()) as { id?: string };
    const id = body.id?.trim() ?? "";
    if (!id) {
      return NextResponse.json({ error: "Review link is required." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("show_review_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .is("revoked_at", null)
      .select("id, show_id, promotion_id, label, expires_at, revoked_at, created_by, created_at")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Review link not found." }, { status: 404 });
    }

    return NextResponse.json({ link: sanitizeLink(data) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to revoke review link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
