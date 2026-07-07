import type { ScreeningReport } from "../screening-report.ts";
import {
  getSupabaseServiceClient,
  isSupabaseConfigured,
} from "./client.ts";

export type PersistedPaymentInput = {
  stripeSessionId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt?: string;
};

export type PersistScreeningInput = {
  payment: PersistedPaymentInput;
  email?: string | null;
  provider: string;
  confidence: number;
  report: ScreeningReport;
};

export type PersistScreeningResult = {
  saved: boolean;
  screeningId: string | null;
  paymentId: string | null;
  reason?: string;
};

type PaymentRow = {
  id: string;
};

type ScreeningRow = {
  id: string;
};

const memoryPayments = new Map<string, { id: string } & PersistedPaymentInput>();
const memoryScreenings = new Map<
  string,
  {
    id: string;
    payment_id: string | null;
    email: string | null;
    provider: string;
    confidence: number;
    report_json: ScreeningReport;
    created_at: string;
  }
>();

export function listScreeningMemoryStoreForTests() {
  return {
    payments: Array.from(memoryPayments.values()),
    screenings: Array.from(memoryScreenings.values()),
  };
}

export function resetScreeningMemoryStoreForTests() {
  memoryPayments.clear();
  memoryScreenings.clear();
}

export async function persistScreening(
  input: PersistScreeningInput,
): Promise<PersistScreeningResult> {
  if (isSupabaseMemoryTestMode()) {
    return persistScreeningInMemory(input);
  }

  if (!isSupabaseConfigured()) {
    console.warn("Supabase persistence skipped", {
      reason: "not_configured",
      stripeSessionId: input.payment.stripeSessionId,
    });
    return {
      saved: false,
      screeningId: null,
      paymentId: null,
      reason: "not_configured",
    };
  }

  try {
    const supabase = getSupabaseServiceClient();
    const email = normalizeEmail(input.email);

    if (email) {
      const { error: userError } = await supabase
        .from("users")
        .upsert({ email }, { onConflict: "email" });
      if (userError) throw userError;
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .upsert(
        {
          stripe_session_id: input.payment.stripeSessionId,
          amount: input.payment.amount,
          currency: input.payment.currency,
          status: input.payment.status,
          created_at: input.payment.createdAt,
        },
        { onConflict: "stripe_session_id" },
      )
      .select("id")
      .single<PaymentRow>();

    if (paymentError) throw paymentError;

    const { data: screening, error: screeningError } = await supabase
      .from("screenings")
      .insert({
        payment_id: payment.id,
        email,
        provider: input.provider,
        confidence: input.confidence,
        report_json: input.report,
      })
      .select("id")
      .single<ScreeningRow>();

    if (screeningError) throw screeningError;

    return {
      saved: true,
      screeningId: screening.id,
      paymentId: payment.id,
    };
  } catch (error) {
    console.error("Supabase persistence failed", {
      stripeSessionId: input.payment.stripeSessionId,
      error,
    });
    return {
      saved: false,
      screeningId: null,
      paymentId: null,
      reason: "supabase_error",
    };
  }
}

export async function loadScreeningById(id: string) {
  if (isSupabaseMemoryTestMode()) {
    const screening = memoryScreenings.get(id);
    return screening
      ? ({ found: true, reason: "ok", screening } as const)
      : ({ found: false, reason: "not_found", screening: null } as const);
  }

  if (!isSupabaseConfigured()) {
    return {
      found: false,
      reason: "not_configured",
      screening: null,
    } as const;
  }

  try {
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("screenings")
      .select("id,payment_id,email,provider,confidence,report_json,created_at")
      .eq("id", id)
      .single();

    if (error) {
      return {
        found: false,
        reason: error.code === "PGRST116" ? "not_found" : "supabase_error",
        screening: null,
      } as const;
    }

    return {
      found: true,
      reason: "ok",
      screening: data,
    } as const;
  } catch (error) {
    console.error("Supabase screening load failed", { id, error });
    return {
      found: false,
      reason: "supabase_error",
      screening: null,
    } as const;
  }
}

function normalizeEmail(email?: string | null) {
  const value = email?.trim().toLowerCase();
  return value && value.includes("@") ? value.slice(0, 320) : null;
}

function persistScreeningInMemory(
  input: PersistScreeningInput,
): PersistScreeningResult {
  const existingPayment = memoryPayments.get(input.payment.stripeSessionId);
  const paymentId = existingPayment?.id ?? crypto.randomUUID();
  memoryPayments.set(input.payment.stripeSessionId, {
    id: paymentId,
    ...input.payment,
  });

  const screeningId = crypto.randomUUID();
  memoryScreenings.set(screeningId, {
    id: screeningId,
    payment_id: paymentId,
    email: normalizeEmail(input.email),
    provider: input.provider,
    confidence: input.confidence,
    report_json: input.report,
    created_at: new Date().toISOString(),
  });

  return {
    saved: true,
    screeningId,
    paymentId,
  };
}

function isSupabaseMemoryTestMode() {
  return process.env.SUPABASE_TEST_MODE === "memory";
}
