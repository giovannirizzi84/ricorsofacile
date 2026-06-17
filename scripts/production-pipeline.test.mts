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
  const previousKey = process.env.GEMINI_API_KEY;

  process.env.VERCEL = "1";
  process.env.GEMINI_API_KEY = "test-key";

  try {
    return await operation();
  } finally {
    restoreEnv("VERCEL", previousVercel);
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
    report?: { summary?: string; aiExecution?: { status?: string } };
    processing?: {
      providerLog?: {
        providerUsed?: string;
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

function mockGeminiFailure(context: { mock: typeof test.mock }) {
  context.mock.method(globalThis, "fetch", async () =>
    new Response(JSON.stringify({ error: "provider unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

test("all-documents-use-gemini-vision-first.test", async (context) => {
  await withProductionEnv(async () => {
    let inlineImageCount = 0;
    context.mock.method(globalThis, "fetch", async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        contents?: Array<{ parts?: Array<{ inlineData?: unknown }> }>;
      };
      inlineImageCount +=
        body.contents?.[0]?.parts?.filter((part) => part.inlineData).length ?? 0;

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      municipality: "Bologna",
                      plate: "DZ923NZ",
                      articleCode: "7",
                      amount: "93,60",
                      classification: "Sosta / Rimozione",
                    }),
                  },
                ],
              },
            },
          ],
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
    assert.equal(payload.processing?.providerLog?.providerUsed, "geminiVision");
    assert.equal(payload.processing?.providerLog?.visionAttempted, true);
    assert.equal(payload.processing?.providerLog?.ocrRecoveryAttempted, false);
    assert.ok(inlineImageCount > 0);
  });
});

test("production-never-runs-tesseract.test", async (context) => {
  await withProductionEnv(async () => {
    mockGeminiFailure(context);

    const buffer = await readFile(bolognaImagePath);
    const response = await requestWithFile(new File([buffer], "bologna.jpeg", {
      type: "image/jpeg",
    }));
    const payload = await readJson(response);

    assert.equal(isProductionRuntime(), true);
    assert.equal(response.status, 200);
    assert.equal(payload.processing?.providerLog?.providerUsed, "none");
    assert.equal(payload.processing?.providerLog?.ocrRecoveryAttempted, false);
    assert.equal(
      payload.processing?.providerLog?.ocrRecoverySkippedReason,
      "disabled_in_production",
    );
    assert.equal(
      payload.processing?.providerLog?.failureReason,
      "GEMINI_FAILED_NO_OCR_IN_PRODUCTION",
    );
    assert.match(
      payload.report?.summary ?? "",
      /Non è stato possibile analizzare il documento con sufficiente affidabilità/i,
    );
  });
});

test("production-scanned-pdf-never-runs-tesseract.test", async (context) => {
  await withProductionEnv(async () => {
    mockGeminiFailure(context);

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
    mockGeminiFailure(context);

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

test("gemini-timeout-does-not-hang-route.test", async (context) => {
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
      "GEMINI_FAILED_NO_OCR_IN_PRODUCTION",
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
