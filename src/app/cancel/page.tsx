import Link from "next/link";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CancelPage() {
  return (
    <section className="bg-[#f4f7f6] py-14">
      <div className="page-shell">
        <Card className="mx-auto max-w-2xl border-0 shadow-soft">
          <CardContent className="p-8 text-center">
            <XCircle className="mx-auto size-12 text-amber-600" />
            <h1 className="mt-5 text-2xl font-semibold">
              Pagamento annullato
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Il pagamento dello screening non è stato completato. Nessuna
              analisi è stata avviata.
            </p>
            <Button asChild className="mt-7 rounded-full bg-[#103d3a]">
              <Link href="/analizza">Torna all’analisi</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
