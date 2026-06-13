import { PackageGuide } from "@/components/package-guide";
import { PageHero } from "@/components/page-hero";
import { ExternalCostsNotice } from "@/components/external-costs-notice";
import { ServicePackages } from "@/components/service-packages";

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Prezzi trasparenti"
        title="Inizia dallo screening, scegli il supporto solo se serve"
        description="Lo Screening AI è automatizzato. Le consulenze e i ricorsi sono valutati dal team legale, che individua caso per caso il percorso più appropriato."
      />
      <section className="section-space bg-[#f6f9f8]">
        <div className="page-shell">
          <ServicePackages />
          <ExternalCostsNotice />
        </div>
      </section>
      <section className="pb-20 pt-6 sm:pb-24">
        <div className="page-shell">
          <PackageGuide />
        </div>
      </section>
    </>
  );
}
