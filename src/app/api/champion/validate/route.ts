import { NextResponse } from "next/server";

import {
  getCompletedShowsForPromotion,
  validateChampionCode,
} from "../../../../lib/championData";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      promotionId?: string;
      code?: string;
    };
    const promotionId = body.promotionId?.trim() ?? "";
    const code = body.code?.trim() ?? "";

    if (!promotionId || !code) {
      return NextResponse.json(
        { error: "Promotion and champion code are required." },
        { status: 400 }
      );
    }

    const codeRow = await validateChampionCode(promotionId, code);
    if (!codeRow) {
      return NextResponse.json(
        { error: "Invalid or inactive champion code." },
        { status: 404 }
      );
    }

    const shows = await getCompletedShowsForPromotion(promotionId);
    return NextResponse.json({
      codeId: codeRow.id,
      shows,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to validate champion code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
