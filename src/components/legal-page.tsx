import { PageHero } from "@/components/page-hero";

export function LegalPage({ eyebrow, title, description, sections }: { eyebrow: string; title: string; description: string; sections: { title: string; text: string }[] }) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} description={description} />
      <section className="section-space bg-white">
        <article className="page-shell max-w-4xl">
          <p className="mb-10 text-sm text-slate-500">Ultimo aggiornamento: 11 giugno 2026 · Testo dimostrativo da sottoporre a revisione legale.</p>
          <div className="space-y-10">
            {sections.map((section) => <section key={section.title}><h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2><p className="mt-4 whitespace-pre-line text-base leading-8 text-slate-600">{section.text}</p></section>)}
          </div>
        </article>
      </section>
    </>
  );
}
