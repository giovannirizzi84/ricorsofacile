import { ReactNode } from "react";

export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="overflow-hidden bg-[#0e3432] py-20 text-white sm:py-24">
      <div className="page-shell relative">
        <div className="absolute -right-32 -top-40 size-96 rounded-full bg-lime-300/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-300">{eyebrow}</p>
          <h1 className="text-balance mt-5 text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">{title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">{description}</p>
          {children && <div className="mt-8">{children}</div>}
        </div>
      </div>
    </section>
  );
}
