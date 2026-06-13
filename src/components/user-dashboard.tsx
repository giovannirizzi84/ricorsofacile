"use client";

import { useState } from "react";
import {
  Bell, Check, ChevronRight, Circle, Download, FilePlus2, FileText,
  FolderOpen, LayoutDashboard, MessageSquare, PenLine, Scale, WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const statuses = [
  "Documenti ricevuti", "Screening AI completato", "In revisione", "Ricorso in preparazione",
  "In attesa firma procura", "Depositato / inviato", "In attesa decisione", "Concluso",
];

export function UserDashboard() {
  const [signed, setSigned] = useState(false);

  return (
    <section className="bg-[#f4f7f6] py-8 sm:py-12">
      <div className="page-shell">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm text-slate-500">Bentornato, Mario</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">La tua area riservata</h1></div>
          <Button className="rounded-full bg-[#103d3a]"><FilePlus2 className="size-4" /> Nuova pratica</Button>
        </div>
        <div className="grid gap-7 lg:grid-cols-[220px_1fr]">
          <aside className="h-fit rounded-2xl border bg-white p-3 lg:sticky lg:top-24">
            {[
              [LayoutDashboard, "Panoramica"], [FolderOpen, "Le mie pratiche"], [FileText, "Documenti"],
              [MessageSquare, "Messaggi"], [WalletCards, "Pagamenti"],
            ].map(([Icon, label], index) => (
              <button key={String(label)} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${index === 0 ? "bg-[#eaf3f0] text-[#0f5752]" : "text-slate-600 hover:bg-slate-50"}`}>
                <Icon className="size-4" />{label as string}
              </button>
            ))}
          </aside>
          <div className="space-y-7">
            <div className="grid gap-5 sm:grid-cols-3">
              <Stat label="Pratiche attive" value="1" icon={FolderOpen} />
              <Stat label="Documenti" value="7" icon={FileText} />
              <Stat label="Nuovi messaggi" value="2" icon={Bell} />
            </div>
            <div className="rounded-2xl border bg-white p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><div className="flex items-center gap-3"><Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">In revisione</Badge><span className="font-mono text-xs text-slate-400">RF-2026-01842</span></div><h2 className="mt-4 text-xl font-semibold">Verbale Polizia Locale di Roma</h2><p className="mt-2 text-sm text-slate-500">Autovelox · Importo €173,00 · Notifica 12/05/2026</p></div>
                <Button variant="outline" className="rounded-full">Apri pratica <ChevronRight className="size-4" /></Button>
              </div>
              <div className="mt-8"><div className="mb-3 flex justify-between text-sm"><span className="font-medium">Avanzamento pratica</span><span className="text-slate-500">38%</span></div><Progress value={38} className="h-2 [&>div]:bg-[#0f756d]" /></div>
              <div className="mt-8 grid gap-y-1 sm:grid-cols-2">
                {statuses.map((status, index) => (
                  <div key={status} className="flex items-center gap-3 py-3 text-sm">
                    <span className={`grid size-6 place-items-center rounded-full ${index < 2 ? "bg-emerald-100 text-emerald-700" : index === 2 ? "bg-[#103d3a] text-white" : "bg-slate-100 text-slate-400"}`}>
                      {index < 2 ? <Check className="size-3.5" /> : <Circle className="size-2 fill-current" />}
                    </span>
                    <span className={index <= 2 ? "font-medium" : "text-slate-400"}>{status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border bg-white p-6">
                <h3 className="font-semibold">Azioni richieste</h3>
                <div className="mt-5 rounded-xl bg-amber-50 p-5">
                  <PenLine className="size-5 text-amber-800" />
                  <p className="mt-3 font-medium">Firma la procura</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">La firma è necessaria per procedere con la preparazione del ricorso.</p>
                  <Button onClick={() => setSigned(true)} disabled={signed} className="mt-4 rounded-full bg-[#103d3a]">{signed ? "Procura firmata" : "Firma ora"} {signed && <Check className="size-4" />}</Button>
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-6">
                <h3 className="font-semibold">Documenti recenti</h3>
                <div className="mt-4 space-y-2">
                  {["Report screening AI.pdf", "Verbale completo.pdf", "Ricevuta pagamento.pdf"].map((file) => <button key={file} className="flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm hover:bg-slate-50"><FileText className="size-4 text-[#0f756d]" /><span className="flex-1">{file}</span><Download className="size-4 text-slate-400" /></button>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Scale }) {
  return <div className="rounded-2xl border bg-white p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div><span className="grid size-11 place-items-center rounded-xl bg-[#eaf3f0] text-[#0f756d]"><Icon className="size-5" /></span></div></div>;
}
