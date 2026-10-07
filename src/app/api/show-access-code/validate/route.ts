import { NextResponse } from "next/server";

import { verifyShowAccessCode } from "../../../../lib/showAccessCodes";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      showId?: string;
      code?: string;
    };
    const showId = body.showId?.trim() ?? "";
    if (!showId) {
      return NextResponse.json({ error: "Show is required." }, { status: 400 });
    }

    const { data: show, error } = await supabaseAdmin
      .from("shows")
      .select("id, access_code_required, access_code_hash")
      .eq("id", showId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!show) {
      return NextResponse.json({ error: "Show not found." }, { status: 404 });
    }
    if (!show.access_code_required) {
      return NextResponse.json({ valid: true, required: false });
    }

    const valid = verifyShowAccessCode(body.code ?? "", show.access_code_hash);
    return NextResponse.json({ valid, required: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to validate access code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
