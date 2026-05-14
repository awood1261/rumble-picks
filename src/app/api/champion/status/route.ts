import { NextResponse } from "next/server";

import { getPromotionChampionshipStatus } from "../../../../lib/championData";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      promotionId?: string;
      showId?: string;
    };
    const promotionId = body.promotionId?.trim() ?? "";
    const showId = body.showId?.trim() ?? "";

    if (!promotionId || !showId) {
      return NextResponse.json(
        { error: "Promotion and show are required." },
        { status: 400 }
      );
    }

    const championship = await getPromotionChampionshipStatus({
      promotionId,
      showId,
    });

    return NextResponse.json({ championship });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load championship status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
