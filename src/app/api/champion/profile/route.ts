import { NextResponse } from "next/server";

import { getChampionClaimsForUser } from "../../../../lib/championData";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userId?: string;
    };
    const userId = body.userId?.trim() ?? "";

    if (!userId) {
      return NextResponse.json(
        { error: "User is required." },
        { status: 400 }
      );
    }

    const claims = await getChampionClaimsForUser(userId);
    return NextResponse.json({ claims });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load champion claims.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
