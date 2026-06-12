import { Clock3, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { ConsultationForm } from "@/components/consultation-form";
import { PageHero } from "@/components/page-hero";

export default function ConsultationPage() {
  return (
    <>
      <PageHero eyebrow="Supporto personalizzato" title="Prenota una consulenza" description="Raccontaci il caso e allega i documenti. Il form simula la presa in carico da parte del team." />
      <section className="section-space">
        <div className="page-shell grid items-start gap-10 lg:grid-cols-[1fr_340px]">
          <ConsultationForm />
          <aside className="space-y-5 lg:sticky lg:top-24">
            <div className="rounded-2xl bg-[#103d3a] p-7 text-white">
              <h2 className="text-xl font-semibold">Cosa succede dopo</h2>
              <div className="mt-6 space-y-5">
                <Info icon={Mail} title="Ricezione richiesta" text="I dati e i file vengono associati alla pratica." />
                <Info icon={Clock3} title="Prima risposta" text="Il team indica tempi e modalità di approfondimento." />
                <Info icon={MessageCircle} title="Contatto preferito" text="Ricevi il riscontro via email, telefono o WhatsApp." />
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
