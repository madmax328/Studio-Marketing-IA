import Link from "next/link";
import type { ReactNode } from "react";
import { SiteLogo } from "@/components/site/site-header";

/** Pages d'accès : panneau de marque à gauche (sombre, comme le site), formulaire à droite. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="site relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div aria-hidden="true" className="halo pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="grid-fade pointer-events-none absolute inset-0" />
        <Link href="/" aria-label="Retour au site" className="relative">
          <SiteLogo />
        </Link>
        <div className="relative max-w-md">
          <p className="text-5xl leading-[1.05] font-semibold tracking-[-0.045em]">
            Vous décrivez. <span className="text-sun">Le studio publie.</span>
          </p>
          <p className="mt-6 text-fg-muted">Présentez votre activité une fois : le studio écrit, programme et publie pour vous.</p>
        </div>
        <ul className="relative flex flex-wrap gap-2 text-xs text-fg-muted" aria-label="Rappels">
          {["Offre gratuite", "Sans carte bancaire", "Jamais votre mot de passe"].map((item) => (
            <li key={item} className="glass rounded-full px-3 py-1.5">
              {item}
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex flex-col border-border bg-background px-4 py-8 sm:px-8 lg:border-l">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            ← Retour au site
          </Link>
          <Link href="/" className="text-sm font-semibold lg:hidden" aria-label="Studio Marketing IA, accueil">
            Studio Marketing IA
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md rounded-2xl border border-border bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_30px_80px_-40px_rgb(255_122_69/0.35)] sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
