import { NextResponse } from "next/server.js";
import { loadScreeningById } from "../../../../lib/supabase/screeningsRepository.ts";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  if (!isUuid(id)) {
    return NextResponse.json({ error: "ID screening non valido" }, { status: 400 });
  }

  const result = await loadScreeningById(id);
  if (!result.found) {
    return NextResponse.json(
      { error: "Report non trovato", reason: result.reason },
      { status: result.reason === "not_configured" ? 503 : 404 },
    );
  }

  return NextResponse.json({
    screening: result.screening,
    report: result.screening.report_json,
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
