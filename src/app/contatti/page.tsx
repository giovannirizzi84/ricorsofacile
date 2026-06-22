import type { Metadata } from "next";
import { Mail, Phone, Send } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const metadata: Metadata = {
  title: "Contatti",
  description:
    "Contatta MulteOnline per supporto sullo screening AI, pagamenti, report e servizi professionali.",
};

const supportEmail = "supporto@multeonline.it";
const supportPhone = "+39 02 1234 5678";

export default function ContactsPage() {
  return (
    <>
      <PageHero
        eyebrow="Assistenza"
        title="Contatti MulteOnline"
        description="Hai bisogno di supporto sul pagamento, sul report o sui servizi di assistenza professionale? Scrivici: ti risponderemo il prima possibile."
      />
      <section className="section-space bg-[#f4f7f6]">
        <div className="page-shell grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-5">
            <Card className="border-0 shadow-soft">
              <CardContent className="p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0f756d]">
                  Nome attività
                </p>
                <h2 className="mt-3 text-2xl font-semibold">MulteOnline</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Piattaforma legal-tech per screening automatico preliminare di
                  verbali e sanzioni amministrative.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-soft">
              <CardContent className="space-y-5 p-6">
                <ContactItem
                  icon={Mail}
                  label="Email supporto"
                  value={supportEmail}
                  href={`mailto:${supportEmail}`}
                />
                <ContactItem
                  icon={Phone}
                  label="Numero assistenza"
                  value={supportPhone}
                  href={`tel:${supportPhone.replace(/\s/g, "")}`}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-soft">
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-2xl font-semibold tracking-tight">
                Invia una richiesta
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Il modulo prepara un’email con le informazioni inserite. Non
                inviare dati sensibili non necessari.
              </p>
              <form
                className="mt-7 grid gap-5"
                action={`mailto:${supportEmail}`}
                method="post"
                encType="text/plain"
              >
                <label>
                  <span className="mb-2 block text-sm font-medium">Nome</span>
                  <Input name="nome" required placeholder="Il tuo nome" />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-medium">Email</span>
                  <Input
                    name="email"
                    required
                    type="email"
                    placeholder="nome@email.it"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-medium">
                    Messaggio
                  </span>
                  <Textarea
                    name="messaggio"
                    required
                    rows={6}
                    placeholder="Descrivi brevemente la tua richiesta."
                  />
                </label>
                <Button className="w-fit rounded-full bg-[#103d3a] px-6">
                  <Send className="size-4" /> Invia richiesta
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

function ContactItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a href={href} className="flex gap-4 rounded-xl border p-4 hover:bg-slate-50">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#e6f2ee] text-[#0f756d]">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block text-sm text-slate-500">{label}</span>
        <span className="mt-1 block font-semibold">{value}</span>
      </span>
    </a>
  );
}
