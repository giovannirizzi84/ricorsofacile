import Link from "next/link";
import { Brand } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="bg-[#0d2f2d] text-white">
      <div className="page-shell grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Brand light />
          <p className="mt-5 max-w-md text-sm leading-6 text-white/65">
            Screening automatico preliminare per comprendere meglio il verbale, i termini e gli elementi che potrebbero meritare approfondimento.
          </p>
        </div>
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-lime-300">Servizio</p>
          <div className="flex flex-col gap-3 text-sm text-white/70">
            <Link href="/analizza" className="hover:text-white">Analizza la multa</Link>
            <Link href="/come-funziona" className="hover:text-white">Come funziona</Link>
            <Link href="/prezzi" className="hover:text-white">Prezzi</Link>
            <Link href="/consulenza" className="hover:text-white">Consulenza professionale</Link>
          </div>
        </div>
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-lime-300">Informazioni</p>
          <div className="flex flex-col gap-3 text-sm text-white/70">
            <Link href="/faq" className="hover:text-white">FAQ</Link>
            <Link href="/privacy" className="hover:text-white">Privacy policy</Link>
            <Link href="/termini" className="hover:text-white">Termini e condizioni</Link>
            <Link href="/contatti" className="hover:text-white">Contatti</Link>
            <Link href="/disclaimer" className="hover:text-white">Disclaimer legale</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="page-shell flex flex-col gap-3 py-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 MulteOnline. Progetto dimostrativo.</p>
          <p>Screening automatizzato preliminare, non parere legale.</p>
        </div>
      </div>
    </footer>
  );
}
