import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  analyzeImagesWithOpenAIVision,
  normalizeOpenAIVisionOutput,
} from "../src/lib/ai/openaiClient.ts";

test("OpenAI Vision costruisce una richiesta con immagini e structured output", async (context) => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-4o";
  let requestBody: {
    model?: string;
    input?: Array<{
      content?: Array<{ type?: string; image_url?: string }>;
    }>;
    text?: { format?: { type?: string; strict?: boolean } };
  } | null = null;

  context.mock.method(globalThis, "fetch", async (_url, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        output: [
          {
            content: [
              {
                text: JSON.stringify({
                  authority: "Comune di Bologna",
                  municipality: "Bologna",
                  noticeNumber: "659881",
                  plate: "X9PJTR",
                  violationDate: "15/04/2025",
                  amountReduced: "42,40",
                  amountOrdinary: "55,00",
                  articleCode: "7",
                  classification: "Sosta / divieto di sosta",
                }),
              },
            ],
          },
        ],
        usage: { input_tokens: 1200, output_tokens: 120 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });

  try {
    const result = await analyzeImagesWithOpenAIVision([
      {
        filename: "verbale.png",
        mimeType: "image/png",
        data: "YWJj",
      },
    ]);

    assert.equal(result.status, "Completata");
    assert.equal(result.output?.plate, "X9PJTR");
    assert.equal(requestBody?.model, "gpt-4o");
    assert.equal(requestBody?.text?.format?.type, "json_schema");
    assert.equal(requestBody?.text?.format?.strict, true);
    const imagePart = requestBody?.input?.[0]?.content?.find(
      (part) => part.type === "input_image",
    );
    assert.equal(imagePart?.image_url, "data:image/png;base64,YWJj");
  } finally {
    restoreEnv("OPENAI_API_KEY", previousKey);
    restoreEnv("OPENAI_MODEL", previousModel);
  }
});

test("normalizza output OpenAI nello schema comune", () => {
  const output = normalizeOpenAIVisionOutput({
    authority: " Comune di Bologna ",
    municipality: "",
    noticeNumber: " 659881 ",
    plate: " x9pjtr ",
    violationDate: "15/04/2025",
    amountReduced: "42,40",
    amountOrdinary: "55,00",
    articleCode: "7",
    classification: "Sosta / divieto di sosta",
  });

  assert.equal(output.authority, "Comune di Bologna");
  assert.equal(output.municipality, null);
  assert.equal(output.plate, "X9PJTR");
});

test("assenza di OPENAI_API_KEY non rompe il provider", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const result = await analyzeImagesWithOpenAIVision([
      {
        filename: "verbale.png",
        mimeType: "image/png",
        data: "YWJj",
      },
    ]);

    assert.equal(result.status, "Chiave non configurata");
    assert.equal(result.available, false);
    assert.equal(result.attempted, false);
  } finally {
    restoreEnv("OPENAI_API_KEY", previousKey);
  }
});

test("benchmark:gpt4o gestisce provider non configurato", () => {
  const env = { ...process.env };
  delete env.OPENAI_API_KEY;
  execFileSync(
    "node",
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      "scripts/benchmark-gpt4o.mts",
    ],
    {
      cwd: process.cwd(),
      env,
      stdio: "pipe",
    },
  );
  const reportPath = path.join(
    process.cwd(),
    "evaluation-results",
    "gpt4o-benchmark-report.json",
  );
  assert.equal(existsSync(reportPath), true);
  const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
    providerErrors?: number;
  };
  assert.equal(typeof report.providerErrors, "number");
});

test("benchmark:compare produce report anche se un provider fallisce o manca", () => {
  execFileSync(
    "node",
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      "scripts/benchmark-compare.mts",
    ],
    {
      cwd: process.cwd(),
      stdio: "pipe",
    },
  );
  assert.equal(
    existsSync(
      path.join(process.cwd(), "evaluation-results", "provider-comparison-report.json"),
    ),
    true,
  );
});

function restoreEnv(key: string, value: string | undefined) {
  if (value) {
    process.env[key] = value;
  } else {
    delete process.env[key];
  }
}
