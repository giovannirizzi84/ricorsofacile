import { NextResponse } from "next/server.js";
import { verifyAdminSecret } from "../../../../../lib/admin/auth.ts";
import {
  updateConsultationStatus,
  type ConsultationStatus,
} from "../../../../../lib/supabase/consultationsRepository.ts";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const allowedStatuses = new Set<ConsultationStatus>([
  "new",
  "contacted",
  "closed",
]);

export async function PATCH(request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as {
    status?: string;
  };

  if (!payload.status || !allowedStatuses.has(payload.status as ConsultationStatus)) {
    return NextResponse.json({ error: "Stato non valido." }, { status: 400 });
  }

  const result = await updateConsultationStatus(
    id,
    payload.status as ConsultationStatus,
  );

  if (!result.updated) {
    return NextResponse.json(
      {
        error:
          result.reason === "not_configured"
            ? "Supabase non configurato."
            : "Richiesta non aggiornata.",
        reason: result.reason,
      },
      { status: result.reason === "not_configured" ? 503 : 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
