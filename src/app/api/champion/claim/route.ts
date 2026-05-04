import { NextResponse } from "next/server";

import {
  createChampionClaim,
  getChampionWinnerForShow,
  validateChampionCode,
} from "../../../../lib/championData";
import type { ChampionClaimType } from "../../../../lib/championTypes";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      promotionId?: string;
      codeId?: string;
      code?: string;
      showId?: string | null;
      claimType?: ChampionClaimType;
      claimedUsername?: string | null;
      claimedAvatar?: string | null;
      claimedByUserId?: string | null;
      claimedByGuestId?: string | null;
    };

    const promotionId = body.promotionId?.trim() ?? "";
    const codeId = body.codeId?.trim() ?? "";
    const code = body.code?.trim() ?? "";
    const claimType = body.claimType;

    if (!promotionId || !codeId || !code || !claimType) {
      return NextResponse.json(
        { error: "Promotion, code, and claim type are required." },
        { status: 400 }
      );
    }

    const codeRow = await validateChampionCode(promotionId, code);
    if (!codeRow || codeRow.id !== codeId) {
      return NextResponse.json(
        { error: "Champion code could not be verified." },
        { status: 403 }
      );
    }

    if (claimType === "show_winner") {
      if (!body.showId) {
        return NextResponse.json(
          { error: "A completed show must be selected." },
          { status: 400 }
        );
      }
      const selectedShow = await getChampionWinnerForShow(
        promotionId,
        body.showId
      );
      if (!selectedShow) {
        return NextResponse.json(
          { error: "Selected show is not eligible for champion claiming." },
          { status: 404 }
        );
      }
      if (!selectedShow.winner_username) {
        return NextResponse.json(
          { error: "No winner could be determined for that show yet." },
          { status: 400 }
        );
      }

      const claim = await createChampionClaim({
        promotionId,
        sourceCodeId: codeId,
        claimType,
        showId: selectedShow.id,
        claimedUsername: selectedShow.winner_username,
        claimedAvatar: selectedShow.winner_avatar,
        claimedByUserId: body.claimedByUserId?.trim() || null,
        claimedByGuestId: body.claimedByGuestId?.trim() || null,
      });

      return NextResponse.json({ claim });
    }

    const claimedUsername = body.claimedUsername?.trim() ?? "";
    if (!claimedUsername) {
      return NextResponse.json(
        { error: "A champion username is required." },
        { status: 400 }
      );
    }

    const claim = await createChampionClaim({
      promotionId,
      sourceCodeId: codeId,
      claimType,
      showId: null,
      claimedUsername,
      claimedAvatar: body.claimedAvatar?.trim() || null,
      claimedByUserId: body.claimedByUserId?.trim() || null,
      claimedByGuestId: body.claimedByGuestId?.trim() || null,
    });

    return NextResponse.json({ claim });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create champion claim.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
