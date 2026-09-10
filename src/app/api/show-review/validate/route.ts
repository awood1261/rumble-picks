import { NextResponse } from "next/server";

import type { ShowReviewValidation } from "../../../../lib/showReviewLinks";
import { hashReviewToken } from "../../../../lib/showReviewTokens";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      showId?: string;
    };
    const token = body.token?.trim() ?? "";
    const requestedShowId = body.showId?.trim() ?? "";

    if (!token) {
      return NextResponse.json<ShowReviewValidation>({
        valid: false,
        reason: "missing",
      });
    }

    const { data: link, error } = await supabaseAdmin
      .from("show_review_links")
      .select("show_id, promotion_id, label, expires_at, revoked_at")
      .eq("token_hash", hashReviewToken(token))
      .maybeSingle();

    if (error || !link) {
      return NextResponse.json<ShowReviewValidation>({
        valid: false,
        reason: "invalid",
      });
    }

    if (requestedShowId && link.show_id !== requestedShowId) {
      return NextResponse.json<ShowReviewValidation>({
        valid: false,
        reason: "invalid",
      });
    }

    if (link.revoked_at) {
      return NextResponse.json<ShowReviewValidation>({
        valid: false,
        reason: "revoked",
      });
    }

    const expiresAt = new Date(link.expires_at).getTime();
    if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
      return NextResponse.json<ShowReviewValidation>({
        valid: false,
        reason: "expired",
      });
    }

    return NextResponse.json<ShowReviewValidation>({
      valid: true,
      showId: link.show_id,
      promotionId: link.promotion_id,
      label: link.label,
      expiresAt: link.expires_at,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to validate review link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
