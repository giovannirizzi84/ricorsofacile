import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";

type EvaluationField =
  | "authority"
  | "plate"
  | "article"
  | "paragraph"
  | "amount"
  | "points"
  | "classification";

type FieldAccuracy = {
  evaluated: number;
  correct: number;
  accuracy: number;
};

type EvaluationSummary = {
  generatedAt: string;
  totalCases: number;
  evaluatedFields: number;
  correctFields: number;
  overallAccuracy: number;
  categorySummaries: Array<{
    category: string;
    documents: number;
    accuracy: number;
    fields: Record<EvaluationField, FieldAccuracy>;
  }>;
  fieldAccuracy: Record<EvaluationField, FieldAccuracy>;
  errorCounts: Record<
    "OCR_ERROR" | "PARSER_ERROR" | "RULE_ENGINE_ERROR" | "CLASSIFICATION_ERROR",
    number
  >;
  problematicFields: Array<{
    field: EvaluationField;
    errors: number;
  }>;
  targets: {
    article: string;
    amount: string;
    classification: string;
    overall: string;
    launchDatasetSize: string;
  };
};

type AdminEvaluationPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Admin Valutazione",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function AdminEvaluationPage({
  searchParams,
}: AdminEvaluationPageProps) {
  const params = await searchParams;
  const configuredToken = process.env.ADMIN_EVALUATION_TOKEN?.trim();

  if (!configuredToken) {
    return (
      <AdminShell>
        <StatusPanel
          title="Dashboard non configurata"
          text="Imposta ADMIN_EVALUATION_TOKEN nelle variabili ambiente per proteggere questa pagina."
        />
      </AdminShell>
    );
  }

  if (params?.token !== configuredToken) {
    return (
      <AdminShell>
        <StatusPanel
          title="Accesso non autorizzato"
          text="Questa dashboard richiede un token amministratore valido."
        />
      </AdminShell>
    );
  }

  const summary = await readLatestSummary();

  if (!summary) {
    return (
      <AdminShell>
        <StatusPanel
          title="Nessun report disponibile"
          text="Esegui npm run evaluate per generare evaluation-results/latest-summary.json."
        />
      </AdminShell>
    );
  }

  const topProblemFields = summary.problematicFields
    .filter((field) => field.errors > 0)
    .slice(0, 5);

  return (
    <AdminShell>
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Verbali testati"
          value={String(summary.totalCases)}
          note={`Target: ${summary.targets.launchDatasetSize}`}
        />
        <MetricCard
          label="Accuracy totale"
          value={`${summary.overallAccuracy}%`}
          note={`Target: ${summary.targets.overall}`}
        />
        <MetricCard
          label="Campi corretti"
          value={`${summary.correctFields}/${summary.evaluatedFields}`}
          note="Solo campi valorizzati in expected.json"
        />
        <MetricCard
          label="Ultima valutazione"
          value={formatDate(summary.generatedAt)}
          note="Generata da npm run evaluate"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-950">
              Accuratezza per categoria
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Misura articolo, importo, targa e classificazione sui verbali
              presenti nel dataset.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3 font-medium">Categoria</th>
                  <th className="py-3 font-medium">Verbali</th>
                  <th className="py-3 font-medium">Articolo</th>
                  <th className="py-3 font-medium">Importo</th>
                  <th className="py-3 font-medium">Targa</th>
                  <th className="py-3 font-medium">Classificazione</th>
                  <th className="py-3 font-medium">Totale</th>
                </tr>
              </thead>
              <tbody>
                {summary.categorySummaries.map((category) => (
                  <tr
                    key={category.category}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-3 font-medium capitalize text-slate-950">
                      {category.category}
                    </td>
                    <td className="py-3 text-slate-700">{category.documents}</td>
                    <td className="py-3 text-slate-700">
                      {category.fields.article.accuracy}%
                    </td>
                    <td className="py-3 text-slate-700">
                      {category.fields.amount.accuracy}%
                    </td>
                    <td className="py-3 text-slate-700">
                      {category.fields.plate.accuracy}%
                    </td>
                    <td className="py-3 text-slate-700">
                      {category.fields.classification.accuracy}%
                    </td>
                    <td className="py-3 font-semibold text-slate-950">
                      {category.accuracy}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">
            Errori principali
          </h2>
          <div className="mt-5 space-y-3">
            {Object.entries(summary.errorCounts).map(([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
              >
                <span className="text-sm font-medium text-slate-700">
                  {type}
                </span>
                <span className="text-lg font-semibold text-slate-950">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">
            Campi più problematici
          </h2>
          <div className="mt-5 space-y-3">
            {topProblemFields.length > 0 ? (
              topProblemFields.map((field) => (
                <div
                  key={field.field}
                  className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3"
                >
                  <span className="text-sm font-medium text-amber-950">
                    {field.field}
                  </span>
                  <span className="text-sm text-amber-800">
                    {field.errors} errori
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                Nessun errore registrato nell’ultimo report.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-950">
            Accuracy per campo
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {Object.entries(summary.fieldAccuracy).map(([field, accuracy]) => (
              <div key={field} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-600">{field}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {accuracy.accuracy}%
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {accuracy.correct}/{accuracy.evaluated} corretti
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

async function readLatestSummary() {
  try {
    const file = await readFile(
      path.join(process.cwd(), "evaluation-results", "latest-summary.json"),
      "utf8",
    );
    return JSON.parse(file) as EvaluationSummary;
  } catch {
    return null;
  }
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-50 py-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">
            MulteOnline Admin
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Valutazione accuratezza
          </h1>
          <p className="mt-3 max-w-3xl text-slate-600">
            Dashboard interna per misurare cosa legge il sistema, cosa sbaglia e
            quali aree richiedono miglioramento prima del lancio.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 text-slate-600">{text}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
