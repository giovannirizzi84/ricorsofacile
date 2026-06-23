import { Suspense } from "react";
import { Clock3, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { ConsultationForm } from "@/components/consultation-form";
import { PageHero } from "@/components/page-hero";

export default function ConsultationPage() {
  return (
    <>
      <PageHero eyebrow="Supporto personalizzato" title="Prenota una consulenza" description="Raccontaci il caso e allega i documenti. La richiesta verrà inoltrata al team MulteOnline per una valutazione professionale." />
      <section className="section-space">
        <div className="page-shell grid items-start gap-10 lg:grid-cols-[1fr_340px]">
          <Suspense fallback={<div className="rounded-3xl border bg-white p-8 shadow-soft">Caricamento form...</div>}>
            <ConsultationForm />
          </Suspense>
          <aside className="space-y-5 lg:sticky lg:top-24">
            <div className="rounded-2xl bg-[#103d3a] p-7 text-white">
              <h2 className="text-xl font-semibold">Cosa succede dopo</h2>
              <div className="mt-6 space-y-5">
                <Info icon={Mail} title="Ricezione richiesta" text="I dati e i file vengono associati alla pratica." />
                <Info icon={Clock3} title="Prima risposta" text="Il team indica tempi e modalità di approfondimento." />
                <Info icon={MessageCircle} title="Riscontro via email" text="Ricevi il riscontro all’indirizzo email indicato nella richiesta." />
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border bg-white p-5 text-sm leading-6 text-slate-600"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#0f756d]" />I documenti caricati vengono usati esclusivamente per valutare e gestire la richiesta.</div>
          </aside>
        </div>
      </section>
    </>
  );
}

function Info({ icon: Icon, title, text }: { icon: typeof Mail; title: string; text: string }) {
  return <div className="flex gap-4"><Icon className="mt-1 size-5 shrink-0 text-lime-300" /><div><p className="font-medium">{title}</p><p className="mt-1 text-sm leading-5 text-white/60">{text}</p></div></div>;
}
