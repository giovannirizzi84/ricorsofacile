import { NextResponse } from "next/server.js";
import {
  sendConsultationEmail,
  type ConsultationEmailAttachment,
} from "../../../lib/email/consultationEmail.ts";
import {
  createConsultationRequest,
  type ConsultationAttachment,
  type ConsultationRequestInput,
} from "../../../lib/supabase/consultationsRepository.ts";

export const runtime = "nodejs";
export const maxDuration = 30;

const allowedAttachmentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maxFiles = 6;
const maxFileSize = 8 * 1024 * 1024;
const maxEmailAttachmentBytes = 6 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const input = readConsultationInput(formData);
    const validationError = validateConsultation(input, formData);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const files = formData
      .getAll("attachments")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const attachmentError = validateAttachments(files);
    if (attachmentError) {
      return NextResponse.json({ error: attachmentError }, { status: 400 });
    }

    const attachments = files.map(fileMetadata);
    const requestInput: ConsultationRequestInput = {
      ...input,
      attachments,
    };

    const persistence = await createConsultationRequest(requestInput);
    const email = await sendConsultationEmail({
      ...requestInput,
      id: persistence.id,
      attachmentsForEmail: await buildEmailAttachments(files),
    });

    return NextResponse.json({
      ok: true,
      consultationId: persistence.id,
      saved: persistence.saved,
      persistenceReason: persistence.reason,
      emailSent: email.sent,
      emailReason: email.reason,
    });
  } catch (error) {
    console.error("Consultation request failed", { error });
    return NextResponse.json(
      {
        error:
          "Non è stato possibile inviare la richiesta. Riprova tra poco o contattaci via email.",
      },
      { status: 500 },
    );
  }
}

function readConsultationInput(formData: FormData) {
  return {
    firstName: readText(formData, "firstName", 120),
    lastName: readText(formData, "lastName", 120),
    email: readText(formData, "email", 320).toLowerCase(),
    phone: readText(formData, "phone", 60) || "Non richiesto",
    consultationType: readText(formData, "consultationType", 80),
    noticeNumber: readText(formData, "noticeNumber", 120),
    authority: readText(formData, "authority", 180),
    amount: readText(formData, "amount", 80),
    description: readText(formData, "description", 4_000),
    preferredTime: readText(formData, "preferredTime", 180),
    screeningId: readText(formData, "screeningId", 120),
  };
}

function validateConsultation(
  input: Omit<ConsultationRequestInput, "attachments">,
  formData: FormData,
) {
  if (!input.firstName) return "Inserisci il nome.";
  if (!input.lastName) return "Inserisci il cognome.";
  if (!input.email.includes("@")) return "Inserisci una email valida.";
  if (!input.consultationType) return "Seleziona il tipo di consulenza.";
  if (!input.description || input.description.length < 20) {
    return "Descrivi il caso con almeno 20 caratteri.";
  }
  if (formData.get("privacyAccepted") !== "on") {
    return "Per inviare la richiesta devi accettare la Privacy Policy.";
  }
  return null;
}

function validateAttachments(files: File[]) {
  if (files.length > maxFiles) {
    return `Puoi caricare al massimo ${maxFiles} allegati.`;
  }

  for (const file of files) {
    if (!allowedAttachmentTypes.has(file.type)) {
      return `Formato allegato non supportato: ${file.name}. Usa PDF, JPG, PNG o WEBP.`;
    }
    if (file.size > maxFileSize) {
      return `${file.name} supera il limite di 8 MB.`;
    }
  }

  return null;
}

async function buildEmailAttachments(files: File[]) {
  let totalBytes = 0;
  const attachments: ConsultationEmailAttachment[] = [];

  for (const file of files) {
    totalBytes += file.size;
    const metadata = fileMetadata(file);
    if (totalBytes <= maxEmailAttachmentBytes) {
      const buffer = Buffer.from(await file.arrayBuffer());
      attachments.push({
        ...metadata,
        contentBase64: buffer.toString("base64"),
      });
    } else {
      attachments.push(metadata);
    }
  }

  return attachments;
}

function fileMetadata(file: File): ConsultationAttachment {
  return {
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

function readText(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
