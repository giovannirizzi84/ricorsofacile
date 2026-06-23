import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";

type AdminPageProps = {
  searchParams?: Promise<{
    secret?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Admin Business",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const secret = params?.secret ?? "";

  if (!secret) {
    return (
      <section className="bg-[#f4f7f6] py-14">
        <div className="page-shell">
          <div className="rounded-3xl border bg-white p-8 shadow-soft">
            <h1 className="text-2xl font-semibold">Accesso admin richiesto</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Apri la dashboard con un URL del tipo{" "}
              <span className="font-mono">/admin?secret=...</span>.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#f4f7f6] py-10 sm:py-14">
      <div className="page-shell">
        <AdminDashboard secret={secret} />
      </div>
    </section>
  );
}
