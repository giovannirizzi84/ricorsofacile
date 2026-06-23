import { NextResponse } from "next/server.js";
import { verifyAdminSecret } from "../../../../lib/admin/auth.ts";
import { loadAdminStats } from "../../../../lib/supabase/consultationsRepository.ts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = verifyAdminSecret(request);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.reason === "not_configured"
            ? "ADMIN_SECRET non configurato."
            : "Accesso non autorizzato.",
      },
      { status: auth.reason === "not_configured" ? 503 : 401 },
    );
  }

  try {
    const result = await loadAdminStats();
    if (!result.configured) {
      return NextResponse.json(
        {
          error: "Supabase non configurato.",
          reason: result.reason,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(result.stats);
  } catch (error) {
    console.error("Admin stats failed", { error });
    return NextResponse.json(
      { error: "Non è stato possibile caricare le statistiche." },
      { status: 500 },
    );
  }
}
