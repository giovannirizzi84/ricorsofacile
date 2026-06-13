import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MulteOnline | Analisi intelligente delle multe",
    template: "%s | MulteOnline",
  },
  description:
    "Carica il verbale e ricevi un’analisi preliminare automatizzata con possibili criticità, termini per il ricorso e valutazione preliminare.",
  openGraph: {
    title: "MulteOnline | Analisi intelligente delle multe",
    description:
      "Carica il verbale e ricevi un’analisi preliminare automatizzata con possibili criticità, termini per il ricorso e valutazione preliminare.",
    siteName: "MulteOnline",
    locale: "it_IT",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "MulteOnline | Analisi intelligente delle multe",
    description:
      "Carica il verbale e ricevi un’analisi preliminare automatizzata con possibili criticità, termini per il ricorso e valutazione preliminare.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
