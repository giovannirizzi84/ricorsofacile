import {
  getSupabaseServiceClient,
  isSupabaseConfigured,
} from "./client.ts";

export type ConsultationStatus = "new" | "contacted" | "closed";

export type ConsultationAttachment = {
  name: string;
  type: string;
  size: number;
  storageBucket?: string;
  storagePath?: string;
  downloadUrl?: string;
  storageStatus?: "stored" | "email_only";
};

export type ConsultationRequestInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consultationType: string;
  noticeNumber?: string | null;
  authority?: string | null;
  amount?: string | null;
  description: string;
  preferredTime?: string | null;
  screeningId?: string | null;
  attachments: ConsultationAttachment[];
};

export type ConsultationRequestRow = {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  consultation_type: string;
  notice_number: string | null;
  authority: string | null;
  amount: string | null;
  description: string;
  preferred_time: string | null;
  screening_id: string | null;
  attachments_json: ConsultationAttachment[];
  status: ConsultationStatus;
};

export type AdminStats = {
  screenings: {
    total: number;
    today: number;
    latest: Array<{
      id: string;
      createdAt: string;
      confidence: number;
      category: string;
      fineAmount: string;
      provider: string;
    }>;
  };
  payments: {
    total: number;
    today: number;
    revenueTotalCents: number;
    revenueTodayCents: number;
  };
  consultations: {
    total: number;
    new: number;
    latest: ConsultationRequestRow[];
  };
  economics: {
    stripeRevenueTotalCents: number;
    screeningSold: number;
    consultationRequests: number;
    conversionRate: number;
  };
};

const memoryConsultations = new Map<string, ConsultationRequestRow>();
const consultationAttachmentBucket = "consultation-attachments";

export async function createConsultationRequest(
  input: ConsultationRequestInput,
) {
  if (isSupabaseMemoryTestMode()) {
    const row = createMemoryConsultation(input);
    memoryConsultations.set(row.id, row);
    return { saved: true, id: row.id, reason: "ok" } as const;
  }

  if (!isSupabaseConfigured()) {
    return { saved: false, id: null, reason: "not_configured" } as const;
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("consultation_requests")
      .insert({
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        phone: input.phone,
        consultation_type: input.consultationType,
        notice_number: nullable(input.noticeNumber),
        authority: nullable(input.authority),
        amount: nullable(input.amount),
        description: input.description,
        preferred_time: nullable(input.preferredTime),
        screening_id: nullable(input.screeningId),
        attachments_json: input.attachments,
        status: "new",
      })
      .select("id")
      .single<{ id: string }>();

    if (error) throw error;
    return { saved: true, id: data.id, reason: "ok" } as const;
  } catch (error) {
    console.error("Consultation persistence failed", { error });
    return { saved: false, id: null, reason: "supabase_error" } as const;
  }
}

export async function updateConsultationStatus(
  id: string,
  status: ConsultationStatus,
) {
  if (isSupabaseMemoryTestMode()) {
    const row = memoryConsultations.get(id);
    if (!row) return { updated: false, reason: "not_found" } as const;
    memoryConsultations.set(id, { ...row, status });
    return { updated: true, reason: "ok" } as const;
  }

  if (!isSupabaseConfigured()) {
    return { updated: false, reason: "not_configured" } as const;
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { error } = await supabase
      .from("consultation_requests")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
    return { updated: true, reason: "ok" } as const;
  } catch (error) {
    console.error("Consultation status update failed", { id, status, error });
    return { updated: false, reason: "supabase_error" } as const;
  }
}

export async function loadAdminStats(): Promise<
  | { configured: true; stats: AdminStats }
  | { configured: false; reason: "not_configured" }
> {
  if (isSupabaseMemoryTestMode()) {
    return { configured: true, stats: buildMemoryStats() };
  }

  if (!isSupabaseConfigured()) {
    return { configured: false, reason: "not_configured" };
  }

  const supabase = getSupabaseServiceClient();
  const todayStart = startOfTodayIso();

  const [
    screeningsResult,
    paymentsResult,
    consultationsResult,
  ] = await Promise.all([
    supabase
      .from("screenings")
      .select("id,created_at,confidence,provider,report_json")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("payments")
      .select("id,amount,currency,status,created_at")
      .eq("status", "paid"),
    supabase
      .from("consultation_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (screeningsResult.error) throw screeningsResult.error;
  if (paymentsResult.error) throw paymentsResult.error;
  if (consultationsResult.error) throw consultationsResult.error;

  const screenings = screeningsResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const consultations = await withSignedAttachmentUrls(
    (consultationsResult.data ?? []) as ConsultationRequestRow[],
  );

  const revenueTotalCents = payments.reduce(
    (sum, payment) => sum + Number(payment.amount ?? 0),
    0,
  );
  const paymentsToday = payments.filter((payment) =>
    String(payment.created_at ?? "") >= todayStart,
  );
  const screeningsToday = screenings.filter((screening) =>
    String(screening.created_at ?? "") >= todayStart,
  );

  return {
    configured: true,
    stats: {
      screenings: {
        total: screenings.length,
        today: screeningsToday.length,
        latest: screenings.map((screening) => ({
          id: String(screening.id),
          createdAt: String(screening.created_at),
          confidence: Number(screening.confidence ?? 0),
          category: readReportValue(screening.report_json, [
            "violationClassification",
            "value",
          ]),
          fineAmount: readReportValue(screening.report_json, [
            "identifiedData",
            "amount",
          ]),
          provider: String(screening.provider ?? ""),
        })),
      },
      payments: {
        total: payments.length,
        today: paymentsToday.length,
        revenueTotalCents,
        revenueTodayCents: paymentsToday.reduce(
          (sum, payment) => sum + Number(payment.amount ?? 0),
          0,
        ),
      },
      consultations: {
        total: consultations.length,
        new: consultations.filter((item) => item.status === "new").length,
        latest: consultations,
      },
      economics: {
        stripeRevenueTotalCents: revenueTotalCents,
        screeningSold: payments.length,
        consultationRequests: consultations.length,
        conversionRate:
          payments.length > 0
            ? Math.round((consultations.length / payments.length) * 10000) / 100
            : 0,
      },
    },
  };
}

export function resetConsultationMemoryStoreForTests() {
  memoryConsultations.clear();
}

export async function storeConsultationAttachments(files: File[]) {
  if (isSupabaseMemoryTestMode()) {
    return files.map((file) => ({
      ...fileMetadataFromFile(file),
      storageBucket: consultationAttachmentBucket,
      storagePath: `memory/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`,
      downloadUrl: "#",
      storageStatus: "stored" as const,
    }));
  }

  if (!isSupabaseConfigured() || files.length === 0) {
    return files.map((file) => ({
      ...fileMetadataFromFile(file),
      storageStatus: "email_only" as const,
    }));
  }

  try {
    const supabase = getSupabaseServiceClient();
    await ensureConsultationAttachmentBucket();

    const stored: ConsultationAttachment[] = [];
    for (const file of files) {
      const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const { error } = await supabase.storage
        .from(consultationAttachmentBucket)
        .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (error) throw error;

      stored.push({
        ...fileMetadataFromFile(file),
        storageBucket: consultationAttachmentBucket,
        storagePath,
        storageStatus: "stored",
      });
    }
    return stored;
  } catch (error) {
    console.error("Consultation attachment storage failed", { error });
    return files.map((file) => ({
      ...fileMetadataFromFile(file),
      storageStatus: "email_only" as const,
    }));
  }
}

function createMemoryConsultation(
  input: ConsultationRequestInput,
): ConsultationRequestRow {
  return {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone,
    consultation_type: input.consultationType,
    notice_number: nullable(input.noticeNumber),
    authority: nullable(input.authority),
    amount: nullable(input.amount),
    description: input.description,
    preferred_time: nullable(input.preferredTime),
    screening_id: nullable(input.screeningId),
    attachments_json: input.attachments,
    status: "new",
  };
}

async function withSignedAttachmentUrls(rows: ConsultationRequestRow[]) {
  if (rows.length === 0 || !isSupabaseConfigured()) return rows;
  const supabase = getSupabaseServiceClient();
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      attachments_json: await Promise.all(
        (row.attachments_json ?? []).map(async (attachment) => {
          if (!attachment.storageBucket || !attachment.storagePath) return attachment;
          const { data, error } = await supabase.storage
            .from(attachment.storageBucket)
            .createSignedUrl(attachment.storagePath, 60 * 30);
          if (error || !data?.signedUrl) return attachment;
          return { ...attachment, downloadUrl: data.signedUrl };
        }),
      ),
    })),
  );
}

function buildMemoryStats(): AdminStats {
  const consultations = Array.from(memoryConsultations.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  return {
    screenings: {
      total: 0,
      today: 0,
      latest: [],
    },
    payments: {
      total: 0,
      today: 0,
      revenueTotalCents: 0,
      revenueTodayCents: 0,
    },
    consultations: {
      total: consultations.length,
      new: consultations.filter((item) => item.status === "new").length,
      latest: consultations,
    },
    economics: {
      stripeRevenueTotalCents: 0,
      screeningSold: 0,
      consultationRequests: consultations.length,
      conversionRate: 0,
    },
  };
}

function readReportValue(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object") return "Non rilevato";
    current = (current as Record<string, unknown>)[segment];
  }
  if (typeof current !== "string") return "Non rilevato";
  return current.trim() ? current : "Non rilevato";
}

function nullable(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function ensureConsultationAttachmentBucket() {
  const supabase = getSupabaseServiceClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;
  if (buckets?.some((bucket) => bucket.name === consultationAttachmentBucket)) return;

  const { error } = await supabase.storage.createBucket(consultationAttachmentBucket, {
    public: false,
    fileSizeLimit: 15 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
  });
  if (error) throw error;
}

function fileMetadataFromFile(file: File): ConsultationAttachment {
  return {
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "allegato";
}

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function isSupabaseMemoryTestMode() {
  return process.env.SUPABASE_TEST_MODE === "memory";
}
