import Link from "next/link";
import { AlertTriangle, Check } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { packages } from "@/lib/content";

export default function PricingPage() {
  return (
    <>
      <PageHero eyebrow="Prezzi trasparenti" title="Scegli solo il supporto che ti serve" description="Dallo screening preliminare alla gestione completa: costi del servizio sempre distinti dai costi vivi della procedura." />
      <section className="section-space bg-white">
        <div className="page-shell">
          <div className="grid gap-6 lg:grid-cols-3">
            {packages.map((item) => (
              <div key={item.name} className={`relative flex flex-col rounded-[1.7rem] border p-7 ${item.featured ? "border-[#0f5752] bg-[#f2f8f5] shadow-soft" : "bg-white"}`}>
                {item.featured && <span className="absolute right-6 top-6 rounded-full bg-lime-300 px-3 py-1 text-xs font-semibold text-[#153a35]">{item.badge}</span>}
                <p className="text-lg font-semibold">{item.name}</p>
                <div className="mt-6">
                  {"previousPrice" in item && item.previousPrice && <span className="mr-2 text-lg text-slate-400 line-through">{item.previousPrice}</span>}
                  <span className="text-4xl font-semibold tracking-tight">{item.price}</span>
                  <span className="ml-2 text-sm text-slate-500">{item.note}</span>
                </div>
                <p className="mt-5 min-h-14 text-sm leading-6 text-slate-600">{item.description}</p>
                <div className="my-6 h-px bg-slate-200" />
                <ul className="flex-1 space-y-4">
                  {item.features.map((feature) => <li key={feature} className="flex gap-3 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-[#0f756d]" />{feature}</li>)}
                </ul>
                <Button className={`mt-8 h-12 rounded-full ${item.featured ? "bg-[#103d3a]" : ""}`} variant={item.featured ? "default" : "outline"} asChild><Link href={item.href}>{item.cta}</Link></Button>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section-space">
        <div className="page-shell">
          <div className="mb-10 max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[.15em] text-[#0f756d]">Costi vivi indicativi</p><h2 className="mt-4 text-3xl font-semibold tracking-tight">Spese della procedura</h2></div>
          <div className="overflow-hidden rounded-2xl border bg-white">
            <div className="grid border-b p-6 md:grid-cols-[1fr_1.4fr]"><p className="font-semibold">Ricorso al Prefetto</p><p className="mt-2 text-sm leading-6 text-slate-600 md:mt-0">Gratuito, salvo eventuali costi PEC o raccomandata. In caso di rigetto la sanzione può aumentare.</p></div>
            <div className="grid border-b p-6 md:grid-cols-[1fr_1.4fr]"><p className="font-semibold">Giudice di Pace fino a €1.033</p><p className="mt-2 text-sm text-slate-600 md:mt-0">Contributo unificato indicativo: €43.</p></div>
            <div className="grid border-b p-6 md:grid-cols-[1fr_1.4fr]"><p className="font-semibold">Da €1.033,01 a €5.200</p><p className="mt-2 text-sm text-slate-600 md:mt-0">Contributo unificato indicativo: €98 + marca da bollo €27.</p></div>
            <div className="grid p-6 md:grid-cols-[1fr_1.4fr]"><p className="font-semibold">Oltre €5.200</p><p className="mt-2 text-sm text-slate-600 md:mt-0">Contributo superiore secondo gli scaglioni di legge applicabili.</p></div>
          </div>
          <div className="mt-5 flex gap-3 rounded-xl bg-amber-50 p-5 text-sm leading-6 text-amber-900"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><p>Gli importi sono indicativi e possono variare. I costi vivi sono separati dal compenso del servizio e vengono verificati prima del deposito.</p></div>
        </div>
      </section>
    </>
  );
}
