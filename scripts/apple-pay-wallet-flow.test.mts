import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  readLatestPendingScreeningSessionId,
  readPendingScreeningMetadata,
} from "../src/lib/payments/pendingScreening.ts";

const checkoutRoutePath =
  "/Users/giovannirizzi/ricorsofacile-ai/src/app/api/checkout/route.ts";
const screeningFlowPath =
  "/Users/giovannirizzi/ricorsofacile-ai/src/components/screening-flow.tsx";
const successClientPath =
  "/Users/giovannirizzi/ricorsofacile-ai/src/app/success/success-client.tsx";

test("apple-pay-success-url.test", async () => {
  const source = await readFile(checkoutRoutePath, "utf8");

  assert.match(source, /mode:\s*"payment"/);
  assert.doesNotMatch(source, /payment_method_types:\s*\[\s*"card"\s*\]/);
  assert.doesNotMatch(source, /payment_method_types:/);
  assert.match(
    source,
    /success_url:\s*`\$\{origin\}\/success\?session_id=\{CHECKOUT_SESSION_ID\}`/,
  );
  assert.match(source, /cancel_url:\s*`\$\{origin\}\/cancel`/);
  assert.match(source, /unit_amount:\s*screeningPrice\.amount/);
});

test("pending-upload-survives-stripe-return.test", () => {
  const storage = new Map<string, string>();
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    },
  });

  try {
    storage.set(
      "multeonline.pending-screening.cs_test_wallet",
      JSON.stringify({
        sessionId: "cs_test_wallet",
        fileCount: 1,
        fileNames: ["verbale.pdf"],
        caseData: {
          notificationDate: "2026-06-23",
          authority: "Comune test",
          amount: "99",
          violationType: "Test",
        },
        createdAt: "2026-06-23T10:00:00.000Z",
      }),
    );
    storage.set("multeonline.pending-screening.latest", "cs_test_wallet");

    const metadata = readPendingScreeningMetadata("cs_test_wallet");
    assert.equal(metadata?.sessionId, "cs_test_wallet");
    assert.equal(metadata?.fileCount, 1);
    assert.deepEqual(metadata?.fileNames, ["verbale.pdf"]);
    assert.equal(readLatestPendingScreeningSessionId(), "cs_test_wallet");
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: previousWindow,
    });
  }
});

test("success-page-recovers-after-wallet-payment.test", async () => {
  const source = await readFile(successClientPath, "utf8");

  assert.match(source, /needsReupload/);
  assert.match(
    source,
    /Pagamento completato\. Ricarica il verbale per completare l’analisi\./,
  );
  assert.match(source, /Non dovrai pagare di nuovo|non dovrai pagare di nuovo/i);
  assert.match(source, /body\.append\("paymentSessionId", currentSessionId\)/);
  assert.match(source, /readPendingScreeningMetadata\(currentSessionId\)/);
});

test("no-page-reload-on-apple-pay.test", async () => {
  const source = await readFile(screeningFlowPath, "utf8");
  const saveIndex = source.indexOf("await savePendingScreening");
  const redirectIndex = source.indexOf("window.location.assign(payload.checkoutUrl)");

  assert.ok(saveIndex > -1, "Il pending upload deve essere salvato prima del redirect");
  assert.ok(redirectIndex > -1, "Il redirect a Stripe deve essere esplicito");
  assert.ok(
    saveIndex < redirectIndex,
    "Il salvataggio del pending upload deve precedere il redirect Stripe",
  );
});
