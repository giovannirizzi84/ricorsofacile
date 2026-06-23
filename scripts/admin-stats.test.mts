import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../src/app/api/admin/stats/route.ts";
import { PATCH } from "../src/app/api/admin/consultations/[id]/route.ts";
import {
  createConsultationRequest,
  resetConsultationMemoryStoreForTests,
} from "../src/lib/supabase/consultationsRepository.ts";

test("admin-stats.test", async () => {
  await withAdminTestEnv(async () => {
    const created = await createConsultationRequest({
      firstName: "Anna",
      lastName: "Verdi",
      email: "anna@example.com",
      phone: "+393331111111",
      consultationType: "Ricorso Prefetto",
      noticeNumber: "TEST-999",
      authority: "Comune di Test",
      amount: "42,00 €",
      description: "Richiesta di verifica.",
      preferredTime: "Sera",
      screeningId: null,
      attachments: [],
    });

    const response = await GET(
      new Request("http://localhost/api/admin/stats?secret=test-secret"),
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.consultations.total, 1);
    assert.equal(payload.consultations.new, 1);

    const patch = await PATCH(
      new Request(
        `http://localhost/api/admin/consultations/${created.id}?secret=test-secret`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "contacted" }),
        },
      ),
      { params: Promise.resolve({ id: created.id ?? "" }) },
    );
    assert.equal(patch.status, 200);

    const updated = await GET(
      new Request("http://localhost/api/admin/stats?secret=test-secret"),
    );
    const updatedPayload = await updated.json();
    assert.equal(updatedPayload.consultations.new, 0);
    assert.equal(updatedPayload.consultations.latest[0].status, "contacted");
  });
});

async function withAdminTestEnv(operation: () => Promise<void>) {
  const previousSupabaseMode = process.env.SUPABASE_TEST_MODE;
  const previousAdminSecret = process.env.ADMIN_SECRET;
  process.env.SUPABASE_TEST_MODE = "memory";
  process.env.ADMIN_SECRET = "test-secret";
  resetConsultationMemoryStoreForTests();

  try {
    await operation();
  } finally {
    restoreEnv("SUPABASE_TEST_MODE", previousSupabaseMode);
    restoreEnv("ADMIN_SECRET", previousAdminSecret);
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
