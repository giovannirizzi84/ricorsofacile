import { Badge } from "@/components/ui/badge";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <Badge className="mb-5 rounded-full bg-[#e6f2ee] px-3 py-1 text-[#0f5752] hover:bg-[#e6f2ee]">{eyebrow}</Badge>
      <h2 className="text-balance text-3xl font-semibold tracking-[-0.04em] text-[#102b2a] sm:text-4xl lg:text-5xl">{title}</h2>
      {description && <p className="mt-5 text-lg leading-8 text-slate-600">{description}</p>}
    </div>
  );
}
