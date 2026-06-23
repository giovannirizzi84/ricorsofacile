"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConsultationStatus = "new" | "contacted" | "closed";

type AdminStats = {
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
	    latest: Array<{
	      id: string;
	      created_at: string;
	      first_name: string;
	      last_name: string;
	      email: string;
	      consultation_type: string;
	      screening_id: string | null;
	      attachments_json: Array<{
	        name: string;
	        size: number;
	        downloadUrl?: string;
	      }>;
	      status: ConsultationStatus;
	    }>;
	  };
  economics: {
    stripeRevenueTotalCents: number;
    screeningSold: number;
    consultationRequests: number;
    conversionRate: number;
  };
};

export function AdminDashboard({ secret }: { secret: string }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadStats(options: { markLoading?: boolean } = {}) {
    const markLoading = options.markLoading ?? true;
    if (markLoading) {
      setLoading(true);
      setError("");
    }
    try {
      const response = await fetch(`/api/admin/stats?secret=${encodeURIComponent(secret)}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Errore dashboard.");
      setStats(payload as AdminStats);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Non è stato possibile caricare la dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: ConsultationStatus) {
    const response = await fetch(
      `/api/admin/consultations/${id}?secret=${encodeURIComponent(secret)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (response.ok) await loadStats();
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadStats({ markLoading: false });
    }, 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret]);

  if (loading && !stats) {
    return <AdminPanel title="Caricamento dashboard" text="Recupero statistiche..." />;
  }

  if (error) {
    return (
      <AdminPanel
        title="Dashboard non disponibile"
        text={error}
        action={<Button onClick={() => void loadStats()}>Riprova</Button>}
      />
    );
  }

  if (!stats) {
    return <AdminPanel title="Nessun dato" text="Nessuna statistica disponibile." />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[#0f756d]">
            MulteOnline Admin
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Dashboard business</h1>
        </div>
        <Button variant="outline" onClick={() => void loadStats()}>
          <RefreshCcw className="size-4" /> Aggiorna
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Screening totali" value={stats.screenings.total} />
        <Metric label="Screening oggi" value={stats.screenings.today} />
        <Metric label="Pagamenti totali" value={stats.payments.total} />
        <Metric label="Ricavi totali" value={formatEuro(stats.payments.revenueTotalCents)} />
        <Metric label="Ricavi oggi" value={formatEuro(stats.payments.revenueTodayCents)} />
        <Metric label="Richieste consulenza" value={stats.consultations.total} />
        <Metric label="Nuove richieste" value={stats.consultations.new} />
        <Metric label="Conversion rate" value={`${stats.economics.conversionRate}%`} />
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-soft">
        <h2 className="text-xl font-semibold">Ultimi 50 screening</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-3">Data</th>
                <th>ScreeningId</th>
                <th>Confidence</th>
                <th>Categoria</th>
                <th>Importo multa</th>
                <th>Provider</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stats.screenings.latest.map((screening) => (
                <tr key={screening.id}>
                  <td className="py-3">{formatDate(screening.createdAt)}</td>
                  <td className="font-mono text-xs">{screening.id}</td>
                  <td>{screening.confidence}</td>
                  <td>{screening.category}</td>
                  <td>{screening.fineAmount}</td>
                  <td>{screening.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-soft">
        <h2 className="text-xl font-semibold">Ultime richieste consulenza</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
	            <thead className="text-xs uppercase text-slate-500">
	              <tr>
	                <th className="py-3">Data</th>
	                <th>Nome</th>
	                <th>Cognome</th>
	                <th>Email</th>
	                <th>Tipo</th>
	                <th>Screening</th>
	                <th>Allegati</th>
	                <th>Stato</th>
	              </tr>
	            </thead>
	            <tbody className="divide-y">
	              {stats.consultations.latest.map((request) => (
	                <tr key={request.id}>
	                  <td className="py-3">{formatDate(request.created_at)}</td>
	                  <td>{request.first_name}</td>
	                  <td>{request.last_name}</td>
	                  <td>{request.email}</td>
	                  <td>{request.consultation_type}</td>
	                  <td className="font-mono text-xs">
	                    {request.screening_id ?? "Non collegato"}
	                  </td>
	                  <td>
	                    <AttachmentLinks attachments={request.attachments_json ?? []} />
	                  </td>
	                  <td>
                    <select
                      value={request.status}
                      className="rounded-lg border px-2 py-1"
                      onChange={(event) =>
                        void updateStatus(
                          request.id,
                          event.target.value as ConsultationStatus,
                        )
                      }
                    >
                      <option value="new">new</option>
                      <option value="contacted">contacted</option>
                      <option value="closed">closed</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric
          label="Incasso Stripe totale"
          value={formatEuro(stats.economics.stripeRevenueTotalCents)}
        />
        <Metric label="Screening venduti" value={stats.economics.screeningSold} />
        <Metric
          label="Consulenze richieste"
          value={stats.economics.consultationRequests}
        />
        <Metric
          label="Conversione screening → consulenza"
          value={`${stats.economics.conversionRate}%`}
        />
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-soft">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function AdminPanel({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border bg-white p-8 shadow-soft">
      <AlertCircle className="size-8 text-amber-600" />
      <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function AttachmentLinks({
  attachments,
}: {
  attachments: Array<{ name: string; size: number; downloadUrl?: string }>;
}) {
  if (attachments.length === 0) return <span className="text-slate-400">Nessuno</span>;

  return (
    <div className="space-y-1">
      {attachments.map((attachment, index) =>
        attachment.downloadUrl ? (
          <a
            key={`${attachment.name}-${index}`}
            href={attachment.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-[#0f756d] underline underline-offset-2"
          >
            {attachment.name} ({formatFileSize(attachment.size)})
          </a>
        ) : (
          <span key={`${attachment.name}-${index}`} className="block text-slate-500">
            {attachment.name} ({formatFileSize(attachment.size)})
          </span>
        ),
      )}
    </div>
  );
}

function formatEuro(cents: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
