"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, FileUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ConsultationForm() {
  const [sent, setSent] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-[1.7rem] border bg-white p-10 text-center shadow-soft">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-8" /></span>
        <h2 className="mt-6 text-2xl font-semibold">Richiesta inviata</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">Abbiamo ricevuto i dati del caso. In questa demo non viene effettuato alcun invio reale; il flusso mostra la conferma prevista per l’utente.</p>
        <Button className="mt-7 rounded-full bg-[#103d3a]" onClick={() => setSent(false)}>Invia una nuova richiesta</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[1.7rem] border bg-white p-6 shadow-soft sm:p-9">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome"><Input required placeholder="Mario" /></Field>
        <Field label="Cognome"><Input required placeholder="Rossi" /></Field>
        <Field label="Email"><Input required type="email" placeholder="mario@email.it" /></Field>
        <Field label="Telefono"><Input required type="tel" placeholder="+39 333 000 0000" /></Field>
        <Field label="Città"><Input required placeholder="Roma" /></Field>
        <Field label="Tipo di multa">
          <select required className="h-10 w-full rounded-md border bg-transparent px-3 text-sm"><option value="">Seleziona</option><option>Autovelox</option><option>ZTL</option><option>Sosta</option><option>Altro</option></select>
        </Field>
        <Field label="Importo"><Input required type="number" placeholder="98,00" /></Field>
        <Field label="Data notifica"><Input required type="date" /></Field>
        <Field label="Descrizione del caso" className="sm:col-span-2"><Textarea required className="min-h-32" placeholder="Descrivi brevemente cosa è successo e i dubbi principali..." /></Field>
        <Field label="Documenti" className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-5 text-sm text-slate-600 hover:bg-slate-50"><FileUp className="size-5 text-[#0f756d]" /><span>Carica verbale e allegati</span><input type="file" multiple className="sr-only" /></label>
        </Field>
        <Field label="Preferenza di contatto" className="sm:col-span-2">
          <div className="flex flex-wrap gap-3">{["Email", "Telefono", "WhatsApp"].map((option) => <label key={option} className="flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm"><input type="radio" name="contact" required />{option}</label>)}</div>
        </Field>
      </div>
      <label className="mt-7 flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-600"><Checkbox required className="mt-1" /><span>Ho letto la Privacy Policy e acconsento al trattamento dei dati per la gestione della richiesta.</span></label>
      <Button type="submit" className="mt-7 h-12 w-full rounded-full bg-[#103d3a] sm:w-auto sm:px-7">Richiedi consulenza <Send className="size-4" /></Button>
    </form>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={className}><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label>;
}
