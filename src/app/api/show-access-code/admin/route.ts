import { NextResponse } from "next/server";

import {
  hashShowAccessCode,
  validateShowAccessCodeInput,
} from "../../../../lib/showAccessCodes";
import { getShowForPromotionManagement } from "../../../../lib/serverPromotionAccess";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      showId?: string;
      enabled?: boolean;
      code?: string;
    };
    const showId = body.showId?.trim() ?? "";
    if (!showId) {
      return NextResponse.json({ error: "Show is required." }, { status: 400 });
    }

    const access = await getShowForPromotionManagement(request, showId);
    if (!access.ok) return access.response;

    const enabled = Boolean(body.enabled);
    const updatePayload: {
      access_code_required: boolean;
      access_code_hash: string | null;
    } = {
      access_code_required: false,
      access_code_hash: null,
    };

    if (enabled) {
      const validation = validateShowAccessCodeInput(body.code ?? "");
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      updatePayload.access_code_required = true;
      updatePayload.access_code_hash = hashShowAccessCode(validation.value);
    }

    const { data, error } = await supabaseAdmin
      .from("shows")
      .update(updatePayload)
      .eq("id", showId)
      .select("id, access_code_required")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      show: {
        id: data.id,
        access_code_required: Boolean(data.access_code_required),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update access code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
