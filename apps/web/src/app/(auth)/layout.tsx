import Link from "next/link";
import type { ReactNode } from "react";
import { SiteLogo } from "@/components/site/site-header";

/** Pages d'accès : rappel de la promesse à gauche, formulaire à droite. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r-[1.5px] border-ink bg-tomato p-10 text-ink lg:flex">
        <Link href="/" aria-label="Retour au site">
          <SiteLogo />
        </Link>
        <div>
          <p className="font-serif text-7xl leading-[0.9]">
            Vos réseaux, <em>enfin</em> sans y penser.
          </p>
          <p className="mt-6 max-w-sm text-ink/80">
            Présentez votre activité une fois : le studio écrit, programme et publie pour vous.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2 text-sm" aria-label="Rappels">
          {["Offre gratuite", "Sans carte bancaire", "Jamais votre mot de passe"].map((item) => (
            <li key={item} className="rounded-full border-[1.5px] border-ink bg-cream px-3 py-1">
              {item}
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex flex-col bg-background px-4 py-8 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            ← Retour au site
          </Link>
          <Link href="/" className="lg:hidden" aria-label="Studio Marketing IA, accueil">
            <span className="text-base font-semibold">Studio Marketing IA</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
