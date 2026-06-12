import { PageHero } from "@/components/page-hero";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { faqs } from "@/lib/content";

export default function FaqPage() {
  return (
    <>
      <PageHero eyebrow="Domande frequenti" title="Risposte chiare prima di iniziare" description="Tempi, costi, documenti e limiti dello screening spiegati senza tecnicismi inutili." />
      <section className="section-space bg-white">
        <div className="page-shell max-w-4xl">
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((item, index) => (
              <AccordionItem key={item.q} value={`item-${index}`} className="rounded-2xl border px-6">
                <AccordionTrigger className="py-6 text-left text-base font-semibold hover:no-underline">{item.q}</AccordionTrigger>
                <AccordionContent className="pb-6 text-sm leading-7 text-slate-600">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </>
  );
}
