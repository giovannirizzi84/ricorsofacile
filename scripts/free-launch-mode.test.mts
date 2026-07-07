import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { POST as analyzePost } from "../src/app/api/analyze/route.ts";
import {
  createConsultationRequest,
  loadAdminStats,
  resetConsultationMemoryStoreForTests,
} from "../src/lib/supabase/consultationsRepository.ts";
import {
  persistScreening,
  resetScreeningMemoryStoreForTests,
} from "../src/lib/supabase/screeningsRepository.ts";
import type { ScreeningReport } from "../src/lib/screening-report.ts";

const bolognaImagePath =
  "/Users/giovannirizzi/ricorsofacile-ai/datasets/sosta/golden-bologna-sosta-rimozione/original.jpeg";

test("free-mode-allows-analysis-without-payment", async (context) => {
  await withEnv(
    {
      FREE_SCREENING_MODE: "true",
      SUPABASE_TEST_MODE: "memory",
      VERCEL: "1",
      NODE_ENV: "production",
      OPENAI_API_KEY: "sk-live-like-test-value",
      OPENAI_MODEL: "gpt-4o",
      STRIPE_ANALYZE_BYPASS: undefined,
    },
    async () => {
      resetScreeningMemoryStoreForTests();
      context.mock.method(globalThis, "fetch", async () =>
        new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              authority: "Comune di Bologna",
              municipality: "Bologna",
              noticeNumber: "659881/2025",
              plate: "X9PJTR",
              violationDate: "15/04/2025",
              amountReduced: "42,40",
              amountOrdinary: "55,00",
              articleCode: "7",
              classification: "Sosta / divieto di sosta",
            }),
            usage: { input_tokens: 1200, output_tokens: 90 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const formData = new FormData();
      const buffer = await readFile(bolognaImagePath);
      formData.append(
        "files",
        new File([buffer], "bologna.jpeg", { type: "image/jpeg" }),
      );

      const response = await analyzePost(
        new Request("http://localhost/api/analyze", {
          method: "POST",
          body: formData,
        }),
      );
      const payload = (await response.json()) as {
        report?: ScreeningReport;
        persistence?: { paymentMode?: string; saved?: boolean };
      };

      assert.equal(response.status, 200);
      assert.equal(payload.persistence?.paymentMode, "free");
      assert.equal(payload.persistence?.saved, true);
      assert.equal(payload.report?.identifiedData.plate, "X9PJTR");
    },
  );
});

test("paid-mode-still-requires-payment", async () => {
  await withEnv(
    {
      FREE_SCREENING_MODE: "false",
      VERCEL: "1",
      NODE_ENV: "production",
      OPENAI_API_KEY: "sk-live-like-test-value",
      STRIPE_ANALYZE_BYPASS: undefined,
    },
    async () => {
      const formData = new FormData();
      formData.append(
        "files",
        new File(["not-used"], "verbale.png", { type: "image/png" }),
      );

      const response = await analyzePost(
        new Request("http://localhost/api/analyze", {
          method: "POST",
          body: formData,
        }),
      );
      const payload = (await response.json()) as { error?: string };

      assert.equal(response.status, 402);
      assert.match(payload.error ?? "", /Pagamento non verificato/i);
    },
  );
});

test("checkout-still-works-when-free-mode-false", async () => {
  const source = await readFile(
    "/Users/giovannirizzi/ricorsofacile-ai/src/app/api/checkout/route.ts",
    "utf8",
  );

  assert.match(source, /mode:\s*"payment"/);
  assert.match(source, /unit_amount:\s*screeningPrice\.amount/);
  assert.ok(source.includes("success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`"));
  assert.ok(source.includes("cancel_url: `${origin}/cancel`"));
});

test("free-mode-ui-copy", async () => {
  const files = await Promise.all(
    [
      "src/components/screening-flow.tsx",
      "src/app/analizza/page.tsx",
      "src/app/page.tsx",
      "src/app/prezzi/page.tsx",
    ].map((file) =>
      readFile(`/Users/giovannirizzi/ricorsofacile-ai/${file}`, "utf8"),
    ),
  );
  const source = files.join("\n");

  assert.match(source, /Verifica gratuitamente la tua multa/);
  assert.match(source, /MulteOnline – Screening AI gratuito/);
  assert.match(source, /Nessun pagamento richiesto durante la fase di lancio/);
  assert.match(source, /Per la fase di lancio/);
});

test("admin-free-paid-stats", async () => {
  await withEnv({ SUPABASE_TEST_MODE: "memory" }, async () => {
    resetScreeningMemoryStoreForTests();
    resetConsultationMemoryStoreForTests();

    const free = await persistScreening({
      payment: {
        stripeSessionId: "free_test_admin",
        amount: 0,
        currency: "eur",
        status: "free",
      },
      email: null,
      provider: "openaiVision",
      confidence: 90,
      report: sampleReport("Sosta / divieto di sosta", "42,40 €"),
    });
    await persistScreening({
      payment: {
        stripeSessionId: "cs_test_paid_admin",
        amount: 99,
        currency: "eur",
        status: "paid",
      },
      email: "paid@example.com",
      provider: "openaiVision",
      confidence: 92,
      report: sampleReport("Autovelox / Eccesso di velocità", "740,32 €"),
    });
    await createConsultationRequest({
      firstName: "Mario",
      lastName: "Rossi",
      email: "mario@example.com",
      phone: "",
      consultationType: "Consulenza scritta",
      noticeNumber: "TEST",
      authority: "Comune di Test",
      amount: "42,40 €",
      description: "Vorrei approfondire.",
      preferredTime: null,
      screeningId: free.screeningId,
      attachments: [],
    });

    const result = await loadAdminStats();
    assert.equal(result.configured, true);
    if (!result.configured) return;

    assert.equal(result.stats.screenings.free, 1);
    assert.equal(result.stats.screenings.paid, 1);
    assert.equal(result.stats.economics.freeScreenings, 1);
    assert.equal(result.stats.economics.screeningSold, 1);
    assert.equal(result.stats.consultations.fromFreeScreenings, 1);
    assert.deepEqual(
      result.stats.screenings.latest.map((screening) => screening.paymentMode).sort(),
      ["free", "paid"],
    );
  });
});

async function withEnv(
  values: Record<string, string | undefined>,
  operation: () => Promise<void>,
) {
  const previous = new Map(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await operation();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    resetScreeningMemoryStoreForTests();
    resetConsultationMemoryStoreForTests();
  }
}

function sampleReport(category: string, amount: string) {
  return {
    confidence: 91,
    identifiedData: {
      amount,
      plate: "AA000AA",
    },
    violationClassification: {
      value: category,
      confidence: "Alta",
    },
  } as ScreeningReport;
}
