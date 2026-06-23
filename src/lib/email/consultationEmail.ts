import type {
  ConsultationAttachment,
  ConsultationRequestInput,
} from "@/lib/supabase/consultationsRepository";

export type ConsultationEmailAttachment = ConsultationAttachment & {
  contentBase64?: string;
};

type SendConsultationEmailInput = ConsultationRequestInput & {
  id: string | null;
  attachmentsForEmail: ConsultationEmailAttachment[];
};

export async function sendConsultationEmail(
  input: SendConsultationEmailInput,
) {
  if (process.env.RESEND_TEST_MODE === "memory") {
    return { sent: true, reason: "test_mode", providerId: "test-email" } as const;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.CONSULTATION_TO_EMAIL?.trim();
  const from =
    process.env.CONSULTATION_FROM_EMAIL?.trim() ||
    "MulteOnline <onboarding@resend.dev>";

  if (!apiKey || !to) {
    return { sent: false, reason: "not_configured", providerId: null } as const;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Nuova richiesta consulenza - MulteOnline",
      html: buildConsultationEmailHtml(input),
      attachments: input.attachmentsForEmail
        .filter((file) => file.contentBase64)
        .map((file) => ({
          filename: file.name,
          content: file.contentBase64,
        })),
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    console.error("Consultation email send failed", {
      status: response.status,
      message: payload.message ?? payload.error ?? "unknown_error",
    });
    return { sent: false, reason: "resend_error", providerId: null } as const;
  }

  return { sent: true, reason: "ok", providerId: payload.id ?? null } as const;
}

function buildConsultationEmailHtml(input: SendConsultationEmailInput) {
  const rows: Array<[string, string]> = [
    ["ID richiesta", input.id ?? "Non salvata"],
    ["Nome", `${input.firstName} ${input.lastName}`],
    ["Email", input.email],
    ["Tipo consulenza", input.consultationType],
    ["Numero verbale", input.noticeNumber ?? "Non indicato"],
    ["Comune / Ente", input.authority ?? "Non indicato"],
    ["Importo sanzione", input.amount ?? "Non indicato"],
    ["Preferenza oraria", input.preferredTime ?? "Non indicata"],
    ["Screening ID", input.screeningId ?? "Non indicato"],
    [
      "Allegati",
      input.attachments.length > 0
        ? input.attachments
            .map((file) => `${file.name} (${Math.round(file.size / 1024)} KB)`)
            .join("<br />")
        : "Nessun allegato",
    ],
  ];

  return `
    <div style="font-family:Arial,sans-serif;color:#10201f;line-height:1.5">
      <h1>Nuova richiesta consulenza - MulteOnline</h1>
      <table style="border-collapse:collapse;width:100%;max-width:720px">
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <td style="border:1px solid #dbe8e4;padding:10px;font-weight:700;background:#f4f7f6">${escapeHtml(label)}</td>
                <td style="border:1px solid #dbe8e4;padding:10px">${value}</td>
              </tr>
            `,
          )
          .join("")}
      </table>
      <h2>Descrizione del caso</h2>
      <p style="white-space:pre-wrap">${escapeHtml(input.description)}</p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
