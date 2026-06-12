import Link from "next/link";
import { Scale } from "lucide-react";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-3" aria-label="RicorsoFacile AI - Home">
      <span className={`grid size-10 place-items-center rounded-xl ${light ? "bg-white/10 text-lime-300" : "bg-[#103d3a] text-lime-300"}`}>
        <Scale className="size-5" strokeWidth={2.2} />
      </span>
      <span className={`text-lg font-bold tracking-tight ${light ? "text-white" : "text-[#123b38]"}`}>
        RicorsoFacile <span className="text-[#428077]">AI</span>
      </span>
    </Link>
  );
}
