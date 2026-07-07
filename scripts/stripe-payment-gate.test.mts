import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/analyze/route.ts";

test("api-analyze-richiede-pagamento-valido.test", async () => {
  const previousOpenAIKey = process.env.OPENAI_API_KEY;
  const previousBypass = process.env.STRIPE_ANALYZE_BYPASS;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFreeMode = process.env.FREE_SCREENING_MODE;

  process.env.OPENAI_API_KEY = "sk-live-like-test-value";
  delete process.env.STRIPE_ANALYZE_BYPASS;
  process.env.NODE_ENV = "production";
  process.env.FREE_SCREENING_MODE = "false";

  try {
    const formData = new FormData();
    formData.append(
      "files",
      new File(["verbale test"], "verbale.txt", {
        type: "image/png",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: formData,
      }),
    );
    const payload = (await response.json()) as { error?: string };

    assert.equal(response.status, 402);
    assert.match(payload.error ?? "", /Pagamento non verificato/i);
  } finally {
    restoreEnv("OPENAI_API_KEY", previousOpenAIKey);
    restoreEnv("STRIPE_ANALYZE_BYPASS", previousBypass);
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("FREE_SCREENING_MODE", previousFreeMode);
  }
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
