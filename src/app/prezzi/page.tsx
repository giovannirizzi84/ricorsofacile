import { PackageGuide } from "@/components/package-guide";
import { PageHero } from "@/components/page-hero";
import { ExternalCostsNotice } from "@/components/external-costs-notice";
import { ServicePackages } from "@/components/service-packages";
import { isFreeScreeningMode } from "@/lib/payments/freeScreeningMode";

export default function PricingPage() {
  const freeMode = isFreeScreeningMode();

  return (
    <>
      <PageHero
        eyebrow="Prezzi trasparenti"
        title={
          freeMode
            ? "MulteOnline – Screening AI gratuito"
            : "Inizia dallo screening, scegli il supporto solo se serve"
        }
        description={
          freeMode
            ? "Carica il verbale e ricevi gratuitamente uno screening preliminare in pochi minuti. Nessun pagamento richiesto durante la fase di lancio."
            : "Lo Screening AI è automatizzato. Le consulenze e i ricorsi sono valutati dal team legale, che individua caso per caso il percorso più appropriato."
        }
      />
      <section className="section-space bg-[#f6f9f8]">
        <div className="page-shell">
          {freeMode ? (
            <div className="rounded-[2rem] border border-lime-300 bg-[#f7fce9] p-8 shadow-soft sm:p-10">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#0f756d]">
                MulteOnline – Screening AI gratuito
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Ottieni gratuitamente uno screening preliminare
              </h2>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-700">
                Carica il verbale e ricevi gratuitamente uno screening
                preliminare in pochi minuti. Il report resta informativo e non
                sostituisce una consulenza legale personalizzata.
              </p>
              <a
                href="/analizza"
                className="mt-7 inline-flex rounded-full bg-[#103d3a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#174c48]"
              >
                Verifica gratuitamente la tua multa
              </a>
            </div>
          ) : (
            <>
              <ServicePackages />
              <ExternalCostsNotice />
            </>
          )}
        </div>
      </section>
      {!freeMode && (
        <section className="pb-20 pt-6 sm:pb-24">
          <div className="page-shell">
            <PackageGuide />
          </div>
        </section>
      )}
    </>
  );
}
