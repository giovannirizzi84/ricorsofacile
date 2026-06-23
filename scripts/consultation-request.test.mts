import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/consultation/route.ts";
import {
  loadAdminStats,
  resetConsultationMemoryStoreForTests,
} from "../src/lib/supabase/consultationsRepository.ts";

test("consultation-request.test", async () => {
  await withConsultationTestEnv(async () => {
    const formData = new FormData();
    formData.set("firstName", "Mario");
    formData.set("lastName", "Rossi");
    formData.set("email", "mario@example.com");
    formData.set("phone", "+393330000000");
    formData.set("consultationType", "Consulenza scritta");
    formData.set("noticeNumber", "TEST-123");
    formData.set("authority", "Comune di Test");
    formData.set("amount", "99,00 €");
    formData.set(
      "description",
      "Vorrei verificare il verbale e capire se conviene approfondire.",
    );
    formData.set("preferredTime", "Mattina");
    formData.set("privacyAccepted", "on");
    formData.append(
      "attachments",
      new File(["report"], "report.pdf", { type: "application/pdf" }),
    );

    const response = await POST(
      new Request("http://localhost/api/consultation", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      saved?: boolean;
      emailSent?: boolean;
      consultationId?: string;
    };

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.saved, true);
    assert.equal(payload.emailSent, true);
    assert.match(payload.consultationId ?? "", uuidPattern);

    const stats = await loadAdminStats();
    assert.equal(stats.configured, true);
    if (stats.configured) {
      assert.equal(stats.stats.consultations.total, 1);
      assert.equal(stats.stats.consultations.new, 1);
    }
  });
});

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function withConsultationTestEnv(operation: () => Promise<void>) {
  const previousSupabaseMode = process.env.SUPABASE_TEST_MODE;
  const previousResendMode = process.env.RESEND_TEST_MODE;
  process.env.SUPABASE_TEST_MODE = "memory";
  process.env.RESEND_TEST_MODE = "memory";
  resetConsultationMemoryStoreForTests();

  try {
    await operation();
  } finally {
    restoreEnv("SUPABASE_TEST_MODE", previousSupabaseMode);
    restoreEnv("RESEND_TEST_MODE", previousResendMode);
    resetConsultationMemoryStoreForTests();
  }
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
