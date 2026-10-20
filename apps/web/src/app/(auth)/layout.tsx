import Link from "next/link";
import type { ReactNode } from "react";
import { SiteLogo } from "@/components/site/site-header";

/** Pages d'accès : panneau « comptoir d'enregistrement » à gauche, formulaire à droite. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="tarmac relative hidden flex-col justify-between overflow-hidden p-10 text-paper lg:flex">
        <Link href="/" aria-label="Retour au site">
          <SiteLogo tone="light" />
        </Link>
        <div>
          <p className="font-board text-xs tracking-[0.25em] text-signal uppercase">Comptoir d&apos;enregistrement</p>
          <p className="mt-5 font-display text-7xl leading-[0.85] font-black uppercase">
            Bienvenue
            <br />
            à <span className="text-signal">bord</span>.
          </p>
          <p className="mt-6 max-w-sm text-paper/65">
            Vos publications décollent à l&apos;heure, même quand vous êtes derrière votre comptoir.
          </p>
        </div>
        <div className="hazard -mx-10 -mb-10 h-3" aria-hidden="true" />
      </aside>
      <main className="flex flex-col bg-background px-4 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            ← Retour au site
          </Link>
          <Link href="/" className="lg:hidden" aria-label="Studio Marketing IA, accueil">
            <span className="font-display text-lg font-extrabold uppercase">Studio Marketing IA</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
