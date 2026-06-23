import assert from "node:assert/strict";
import test from "node:test";
import { sendConsultationEmail } from "../src/lib/email/consultationEmail.ts";

test("consultation-email.test", async () => {
  const previous = process.env.RESEND_TEST_MODE;
  process.env.RESEND_TEST_MODE = "memory";

  try {
    const result = await sendConsultationEmail({
      id: "consultation-test",
      firstName: "Mario",
      lastName: "Rossi",
      email: "mario@example.com",
      phone: "+393330000000",
      consultationType: "Videochiamata",
      noticeNumber: "TEST-123",
      authority: "Comune di Test",
      amount: "99,00 €",
      description: "Richiesta di verifica preliminare del verbale.",
      preferredTime: "Pomeriggio",
      screeningId: "screening-test",
      attachments: [{ name: "verbale.pdf", type: "application/pdf", size: 12 }],
      attachmentsForEmail: [
        {
          name: "verbale.pdf",
          type: "application/pdf",
          size: 12,
          contentBase64: Buffer.from("test").toString("base64"),
        },
      ],
    });

    assert.equal(result.sent, true);
    assert.equal(result.providerId, "test-email");
  } finally {
    if (previous === undefined) {
      delete process.env.RESEND_TEST_MODE;
    } else {
      process.env.RESEND_TEST_MODE = previous;
    }
  }
});
