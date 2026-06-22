import { PageHero } from "@/components/page-hero";

export function LegalPage({
  eyebrow,
  title,
  description,
  sections,
  updatedAt = "22 giugno 2026",
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: { title: string; text: string }[];
  updatedAt?: string;
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} description={description} />
      <section className="section-space bg-white">
        <article className="page-shell max-w-4xl">
          <p className="mb-10 text-sm text-slate-500">
            Ultimo aggiornamento: {updatedAt}. Le informazioni sono redatte in
            linguaggio chiaro e dovranno essere aggiornate in caso di variazioni
            tecniche, societarie o normative.
          </p>
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {section.title}
                </h2>
                <p className="mt-4 whitespace-pre-line text-base leading-8 text-slate-600">
                  {section.text}
                </p>
              </section>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
