import Link from "next/link";
import { ArrowRight, CarFront, Gauge, ParkingCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const examples = [
  {
    icon: ParkingCircle,
    fine: "Multa da €90 per divieto di sosta",
    package: "Consulenza Legale €19,90",
  },
  {
    icon: Gauge,
    fine: "Multa da €320 per ZTL o autovelox",
    package: "Ricorso Smart €79",
  },
  {
    icon: CarFront,
    fine: "Multa da €750 con decurtazione punti o sospensione patente",
    package: "Ricorso Premium €149",
  },
];

export function PackageGuide() {
  return (
    <div className="rounded-[2rem] bg-[#103d3a] p-6 text-white sm:p-10 lg:p-12">
      <div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-lime-300">
            Orientamento
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Non sai quale pacchetto scegliere?
          </h2>
          <p className="mt-5 text-base leading-7 text-white/70">
            Inizia dallo Screening AI a €0,99. Il sistema rileverà le
            informazioni principali del verbale e ti aiuterà a capire se la
            pratica merita un approfondimento. In base all’importo e alla
            complessità della sanzione potrai poi scegliere se richiedere
            consulenza o assistenza professionale.
          </p>
          <Button
            size="lg"
            className="mt-7 h-14 rounded-full bg-lime-300 px-7 font-semibold text-[#153a35] hover:bg-lime-200"
            asChild
          >
            <Link href="/analizza">
              Analizza la tua multa <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4">
          {examples.map((example, index) => {
            const Icon = example.icon;
            return (
              <article
                key={example.fine}
                className="flex gap-4 rounded-2xl border border-white/12 bg-white/8 p-5"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime-300/15 text-lime-300">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/50">
                    Esempio {index + 1}
                  </p>
                  <p className="mt-1 font-medium">{example.fine}</p>
                  <p className="mt-2 text-sm text-lime-300">
                    Pacchetto consigliato: {example.package}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
