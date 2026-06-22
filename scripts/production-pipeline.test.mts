import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { jsPDF } from "jspdf";
import { POST } from "../src/app/api/analyze/route.ts";
import {
  isOcrRecoveryEnabled,
  isProductionRuntime,
} from "../src/lib/runtime/environment.ts";

const bolognaImagePath =
  "/Users/giovannirizzi/ricorsofacile-ai/datasets/sosta/golden-bologna-sosta-rimozione/original.jpeg";

async function withProductionEnv<T>(operation: () => Promise<T>) {
  const previousVercel = process.env.VERCEL;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;
  const previousOpenAIModel = process.env.OPENAI_MODEL;
  const previousKey = process.env.GEMINI_API_KEY;

  process.env.VERCEL = "1";
  process.env.OPENAI_API_KEY = "test-openai-key";
  process.env.OPENAI_MODEL = "gpt-4o";
  process.env.GEMINI_API_KEY = "test-key";

  try {
    return await operation();
  } finally {
    restoreEnv("VERCEL", previousVercel);
    restoreEnv("OPENAI_API_KEY", previousOpenAIKey);
    restoreEnv("OPENAI_MODEL", previousOpenAIModel);
    restoreEnv("GEMINI_API_KEY", previousKey);
  }
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

async function requestWithFile(file: File) {
  const formData = new FormData();
  formData.append("files", file);
  return POST(new Request("http://localhost/api/analyze", {
    method: "POST",
    body: formData,
  }));
}

async function readJson(response: Response) {
  return response.json() as Promise<{
    report?: { summary?: string; aiExecution?: { status?: string; provider?: string } };
    processing?: {
      providerLog?: {
        providerUsed?: string;
        openaiAttempted?: boolean;
        openaiStatus?: string;
        openaiDurationMs?: number;
        openaiCostEstimate?: number;
        geminiFallbackAttempted?: boolean;
        geminiFallbackStatus?: string;
        visionAttempted?: boolean;
        visionStatus?: string;
        ocrRecoveryAttempted?: boolean;
        ocrRecoverySkippedReason?: string;
        failureReason?: string;
      };
      durationMs?: number;
    };
  }>;
}

function mockOpenAISuccess(context: { mock: typeof test.mock }) {
  context.mock.method(globalThis, "fetch", async () =>
    new Response(
      JSON.stringify({
        output: [
          {
            content: [
              {
                text: JSON.stringify({
                  authority: "Comune di Bologna",
                  municipality: "Bologna",
                  noticeNumber: "635227-71",
                  plate: "DZ923NZ",
                  violationDate: "28/01/2026",
                  amountReduced: "93,60",
                  amountOrdinary: "93,60",
                  articleCode: "7",
                  classification: "Sosta / Rimozione",
                }),
              },
            ],
          },
        ],
        usage: { input_tokens: 1200, output_tokens: 80 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

function mockAllVisionFailure(context: { mock: typeof test.mock }) {
  context.mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ error: "provider unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

test("production-uses-openai-primary.test", async (context) => {
  await withProductionEnv(async () => {
    let inlineImageCount = 0;
    context.mock.method(globalThis, "fetch", async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        input?: Array<{ content?: Array<{ type?: string; image_url?: string }> }>;
      };
      inlineImageCount +=
        body.input?.[0]?.content?.filter((part) => part.type === "input_image").length ?? 0;

      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            authority: "Comune di Bologna",
            municipality: "Bologna",
            noticeNumber: "635227-71",
            plate: "DZ923NZ",
            violationDate: "28/01/2026",
            amountReduced: "93,60",
            amountOrdinary: "93,60",
            articleCode: "7",
            classification: "Sosta / Rimozione",
          }),
          usage: { input_tokens: 1200, output_tokens: 80 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const buffer = await readFile(bolognaImagePath);
    const response = await requestWithFile(new File([buffer], "bologna.jpeg", {
      type: "image/jpeg",
    }));
    const payload = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(payload.processing?.providerLog?.providerUsed, "openaiVision");
    assert.equal(payload.processing?.providerLog?.openaiAttempted, true);
    assert.equal(payload.processing?.providerLog?.openaiStatus, "Completata");
    assert.equal(payload.processing?.providerLog?.geminiFallbackAttempted, false);
    assert.equal(payload.processing?.providerLog?.visionAttempted, true);
    assert.equal(payload.processing?.providerLog?.ocrRecoveryAttempted, false);
    assert.ok((payload.processing?.providerLog?.openaiCostEstimate ?? 0) > 0);
    assert.ok(inlineImageCount > 0);
  });
});

test("gemini-is-not-primary.test", async (context) => {
  await withProductionEnv(async () => {
    const urls: string[] = [];
    context.mock.method(globalThis, "fetch", async (url, init) => {
      urls.push(String(url));
      const body = JSON.parse(String(init?.body));
      assert.ok(body.input, "La prima richiesta deve usare OpenAI Responses API");
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            authority: "Comune di Bologna",
            municipality: "Bologna",
            noticeNumber: "635227-71",
            plate: "DZ923NZ",
            violationDate: "28/01/2026",
            amountReduced: "93,60",
            amountOrdinary: "93,60",
            articleCode: "7",
            classification: "Sosta / Rimozione",
          }),
          usage: { input_tokens: 1200, output_tokens: 80 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const buffer = await readFile(bolognaImagePath);
    const response = await requestWithFile(new File([buffer], "bologna.jpeg", {
      type: "image/jpeg",
    }));
    const payload = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(payload.processing?.providerLog?.providerUsed, "openaiVision");
    assert.equal(payload.processing?.providerLog?.geminiFallbackAttempted, false);
    assert.equal(urls.some((url) => /generativelanguage/i.test(url)), false);
  });
});

test("production-never-runs-tesseract.test", async (context) => {
  await withProductionEnv(async () => {
    mockAllVisionFailure(context);

    const buffer = await readFile(bolognaImagePath);
    const response = await requestWithFile(new File([buffer], "bologna.jpeg", {
      type: "image/jpeg",
    }));
    const payload = await readJson(response);

    assert.equal(isProductionRuntime(), true);
    assert.equal(response.status, 200);
    assert.equal(payload.processing?.providerLog?.providerUsed, "none");
    assert.equal(payload.processing?.providerLog?.openaiAttempted, true);
    assert.equal(payload.processing?.providerLog?.geminiFallbackAttempted, true);
    assert.equal(payload.processing?.providerLog?.ocrRecoveryAttempted, false);
    assert.equal(
      payload.processing?.providerLog?.ocrRecoverySkippedReason,
      "disabled_in_production",
    );
    assert.equal(
      payload.processing?.providerLog?.failureReason,
      "OPENAI_AND_GEMINI_FAILED_NO_OCR_IN_PRODUCTION",
    );
    assert.match(
      payload.report?.summary ?? "",
      /Non è stato possibile analizzare il documento con sufficiente affidabilità/i,
    );
  });
});

test("production-scanned-pdf-never-runs-tesseract.test", async (context) => {
  await withProductionEnv(async () => {
    mockAllVisionFailure(context);

    const imageBuffer = await readFile(bolognaImagePath);
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    pdf.addImage(
      `data:image/jpeg;base64,${imageBuffer.toString("base64")}`,
      "JPEG",
      8,
      8,
      194,
      281,
    );
    const pdfBuffer = Buffer.from(pdf.output("arraybuffer"));

    const response = await requestWithFile(new File([pdfBuffer], "scanner.pdf", {
      type: "application/pdf",
    }));
    const payload = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(payload.processing?.providerLog?.visionAttempted, true);
    assert.equal(payload.processing?.providerLog?.ocrRecoveryAttempted, false);
    assert.equal(
      payload.processing?.providerLog?.ocrRecoverySkippedReason,
      "disabled_in_production",
    );
  });
});

test("gemini-failure-production-returns-controlled-response.test", async (context) => {
  await withProductionEnv(async () => {
    mockAllVisionFailure(context);

    const buffer = await readFile(bolognaImagePath);
    const response = await requestWithFile(new File([buffer], "bologna.jpeg", {
      type: "image/jpeg",
    }));
    const payload = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(payload.report?.aiExecution?.status, "Provider non disponibile");
    assert.match(
      payload.report?.summary ?? "",
      /foto più nitida, ritagliata sul verbale, oppure un PDF leggibile/i,
    );
  });
});

test("openai-failure-does-not-timeout.test", async (context) => {
  await withProductionEnv(async () => {
    context.mock.method(globalThis, "fetch", async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });

    const buffer = await readFile(bolognaImagePath);
    const startedAt = Date.now();
    const response = await requestWithFile(new File([buffer], "bologna.jpeg", {
      type: "image/jpeg",
    }));
    const payload = await readJson(response);

    assert.equal(response.status, 200);
    assert.ok(Date.now() - startedAt < 5_000);
    assert.equal(
      payload.processing?.providerLog?.failureReason,
      "OPENAI_AND_GEMINI_FAILED_NO_OCR_IN_PRODUCTION",
    );
  });
});

test("report-does-not-show-provider-details.test", async (context) => {
  await withProductionEnv(async () => {
    mockOpenAISuccess(context);

    const buffer = await readFile(bolognaImagePath);
    const response = await requestWithFile(new File([buffer], "bologna.jpeg", {
      type: "image/jpeg",
    }));
    const payload = await readJson(response);
    const userVisible = JSON.stringify({
      summary: payload.report?.summary,
    });

    assert.equal(response.status, 200);
    assert.doesNotMatch(
      userVisible,
      /OpenAI|GPT-4o|Gemini|provider|token|Tesseract|costi API/i,
    );
  });
});

test("local-dev-can-use-ocr-fallback.test", () => {
  const previousVercel = process.env.VERCEL;
  const previousNodeEnv = process.env.NODE_ENV;

  delete process.env.VERCEL;
  process.env.NODE_ENV = "test";

  try {
    assert.equal(isProductionRuntime(), false);
    assert.equal(isOcrRecoveryEnabled(), true);
  } finally {
    restoreEnv("VERCEL", previousVercel);
    restoreEnv("NODE_ENV", previousNodeEnv);
  }
});
