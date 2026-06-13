"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/#come-funziona", label: "Come funziona" },
  { href: "/#prezzo", label: "Prezzo" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-xl">
      <div className="page-shell flex h-18 items-center justify-between">
        <Brand />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navigazione principale">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium text-slate-600 hover:text-[#0f5752]">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Button variant="ghost" asChild>
            <Link href="/area-utente">Area utente</Link>
          </Button>
          <Button className="rounded-full bg-[#103d3a] px-5 hover:bg-[#0b302e]" asChild>
            <Link href="/analizza">Analizza la tua multa</Link>
          </Button>
        </div>
        <button
          className="grid size-10 place-items-center rounded-lg border lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Chiudi menu" : "Apri menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t bg-white px-5 py-5 lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1">
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 font-medium hover:bg-slate-50">
                {link.label}
              </Link>
            ))}
            <Link href="/area-utente" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 font-medium hover:bg-slate-50">
              Area utente
            </Link>
            <Button className="mt-3 h-12 rounded-full bg-[#103d3a]" asChild>
              <Link href="/analizza" onClick={() => setOpen(false)}>Analizza la tua multa</Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
