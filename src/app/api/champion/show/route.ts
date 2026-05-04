import { NextResponse } from "next/server";

import {
  getChampionWinnerForShow,
  validateChampionCode,
} from "../../../../lib/championData";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      promotionId?: string;
      code?: string;
      showId?: string;
    };
    const promotionId = body.promotionId?.trim() ?? "";
    const code = body.code?.trim() ?? "";
    const showId = body.showId?.trim() ?? "";

    if (!promotionId || !code || !showId) {
      return NextResponse.json(
        { error: "Promotion, code, and show are required." },
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

    const show = await getChampionWinnerForShow(promotionId, showId);
    if (!show) {
      return NextResponse.json(
        { error: "Selected show is not eligible for champion claiming." },
        { status: 404 }
      );
    }

    return NextResponse.json({ show });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load champion show details.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
