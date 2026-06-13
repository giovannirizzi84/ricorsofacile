import { CircleAlert } from "lucide-react";

export function ExternalCostsNotice() {
  return (
    <div className="mt-8 flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
      <CircleAlert className="mt-0.5 size-5 shrink-0" />
      <p>
        I prezzi indicati si riferiscono esclusivamente ai servizi offerti da
        MulteOnline. Eventuali contributi, marche, diritti, spese di notifica,
        contributo unificato o altri costi previsti dalla normativa per la
        presentazione del ricorso restano a carico del cliente.
      </p>
    </div>
  );
}
