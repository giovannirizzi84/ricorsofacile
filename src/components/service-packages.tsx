import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { packages } from "@/lib/content";

export function ServicePackages() {
  return (
    <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4">
      {packages.map((item) => {
        const darkCard = item.featured;
        const primaryCard = item.primaryEntry;

        return (
          <article
            key={item.name}
            className={`relative flex flex-col rounded-[2rem] border p-7 ${
              darkCard
                ? "border-[#0f756d] bg-[#103d3a] text-white shadow-[0_24px_70px_rgba(13,52,49,.18)]"
                : primaryCard
                  ? "border-lime-400 bg-[#f7fce9] shadow-[0_18px_55px_rgba(91,126,37,.12)] ring-2 ring-lime-300"
                  : "bg-white"
            }`}
          >
            {item.badge && (
              <span
                className={`mb-5 w-fit rounded-full px-3 py-1 text-xs font-bold ${
                  darkCard
                    ? "bg-lime-300 text-[#153a35]"
                    : "bg-[#103d3a] text-white"
                }`}
              >
                {item.badge}
              </span>
            )}
            <p
              className={`text-sm font-bold uppercase tracking-[0.15em] ${
                darkCard ? "text-lime-300" : "text-[#0f756d]"
              }`}
            >
              {item.name}
            </p>
            <div className="mt-5">
              <span className="text-4xl font-semibold tracking-[-0.05em]">
                {item.price}
              </span>
              {primaryCard && (
                <span className="ml-2 text-xs text-slate-500">una tantum</span>
              )}
            </div>
            {item.audience && (
              <p
                className={`mt-3 text-xs font-semibold ${
                  darkCard ? "text-white/75" : "text-[#0f756d]"
                }`}
              >
                {item.audience}
              </p>
            )}
            <p
              className={`mt-5 text-sm leading-6 ${
                darkCard ? "text-white/68" : "text-slate-600"
              }`}
            >
              {item.description}
            </p>
            <div
              className={`my-6 h-px ${
                darkCard ? "bg-white/12" : "bg-slate-200"
              }`}
            />
            <ul className="flex-1 space-y-3 text-sm">
              {item.features.map((feature) => (
                <li key={feature} className="flex gap-3">
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
                      darkCard
                        ? "bg-lime-300/15 text-lime-300"
                        : "bg-[#e3efeb] text-[#0f756d]"
                    }`}
                  >
                    <Check className="size-3.5" />
                  </span>
                  <span className={darkCard ? "text-white/85" : ""}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
            {item.idealFor && (
              <div
                className={`mt-6 rounded-2xl p-4 ${
                  darkCard ? "bg-white/8" : "bg-[#f4f7f6]"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-[0.12em]">
                  Ideale per
                </p>
                <p
                  className={`mt-2 text-xs leading-5 ${
                    darkCard ? "text-white/70" : "text-slate-600"
                  }`}
                >
                  {item.idealFor.join(" · ")}
                </p>
              </div>
            )}
            {item.exclusion && (
              <p className="mt-6 rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
                {item.exclusion}
              </p>
            )}
            <Button
              size="lg"
              variant={darkCard || primaryCard ? "default" : "outline"}
              className={`mt-7 h-12 w-full rounded-full ${
                darkCard
                  ? "bg-lime-300 font-semibold text-[#153a35] hover:bg-lime-200"
                  : primaryCard
                    ? "bg-[#103d3a] text-white hover:bg-[#174c48]"
                    : ""
              }`}
              asChild
            >
              <Link href={item.href}>{item.cta}</Link>
            </Button>
          </article>
        );
      })}
    </div>
  );
}
