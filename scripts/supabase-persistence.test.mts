import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../src/app/api/screenings/[id]/route.ts";
import { recordCheckoutSession } from "../src/lib/payments/paymentTracking.ts";
import type { ScreeningReport } from "../src/lib/screening-report.ts";
import {
  loadScreeningById,
  persistScreening,
} from "../src/lib/supabase/screeningsRepository.ts";

test("screening-save.test", async () => {
  await withMemorySupabase(async () => {
    const result = await persistScreening({
      payment: {
        stripeSessionId: "cs_test_screening_save",
        amount: 99,
        currency: "eur",
        status: "paid",
        createdAt: "2026-06-22T00:00:00.000Z",
      },
      email: "utente@example.com",
      provider: "openaiVision",
      confidence: 92,
      report: sampleReport(),
    });

    assert.equal(result.saved, true);
    assert.match(result.screeningId ?? "", uuidPattern);
    assert.match(result.paymentId ?? "", uuidPattern);
  });
});

test("screening-load.test", async () => {
  await withMemorySupabase(async () => {
    const saved = await persistScreening({
      payment: {
        stripeSessionId: "cs_test_screening_load",
        amount: 99,
        currency: "eur",
        status: "paid",
      },
      email: "utente@example.com",
      provider: "openaiVision",
      confidence: 88,
      report: sampleReport(),
    });

    assert.ok(saved.screeningId);
    const loaded = await loadScreeningById(saved.screeningId);
    assert.equal(loaded.found, true);
    assert.equal(loaded.screening?.confidence, 88);
    assert.equal(loaded.screening?.provider, "openaiVision");

    const response = await GET(new Request("http://localhost/api/screenings/test"), {
      params: Promise.resolve({ id: saved.screeningId }),
    });
    const payload = (await response.json()) as {
      report?: ScreeningReport;
      screening?: { id?: string };
    };

    assert.equal(response.status, 200);
    assert.equal(payload.screening?.id, saved.screeningId);
    assert.equal(payload.report?.confidence, 91);
  });
});

test("payment-link.test", () => {
  const record = recordCheckoutSession({
    id: "cs_test_payment_link",
    amount_total: 99,
    currency: "eur",
    created: 1782096000,
    payment_status: "paid",
    customer_details: {
      email: "pagatore@example.com",
    },
  } as never);

  assert.equal(record.sessionId, "cs_test_payment_link");
  assert.equal(record.amount, 99);
  assert.equal(record.currency, "eur");
  assert.equal(record.status, "paid");
  assert.equal(record.email, "pagatore@example.com");
});

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function withMemorySupabase(operation: () => Promise<void>) {
  const previous = process.env.SUPABASE_TEST_MODE;
  process.env.SUPABASE_TEST_MODE = "memory";

  try {
    await operation();
  } finally {
    if (previous === undefined) {
      delete process.env.SUPABASE_TEST_MODE;
    } else {
      process.env.SUPABASE_TEST_MODE = previous;
    }
  }
}

function sampleReport() {
  return {
    confidence: 91,
    aiExecution: {
      provider: "OpenAI GPT-4o",
      model: "gpt-4o",
      attempted: true,
      promptExecuted: true,
      fallbackUsed: false,
      status: "Completata",
    },
    identifiedData: {
      reportNumber: "TEST-001",
      plate: "AA000AA",
    },
    summary: "Report test",
  } as ScreeningReport;
}
