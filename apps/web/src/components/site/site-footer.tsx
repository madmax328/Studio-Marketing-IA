import Link from "next/link";
import { SiteLogo } from "./site-header";

export function SiteFooter() {
  return (
    <footer className="bg-night text-paper">
      <div className="hazard h-3" aria-hidden="true" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <SiteLogo tone="light" />
          <p className="max-w-sm text-sm text-paper/60">
            Le pilote automatique de vos réseaux sociaux : il rédige, programme et publie pour vous, à partir de ce que vous
            lui avez appris de votre marque.
          </p>
        </div>
        <div>
          <p className="mb-3 font-board text-xs tracking-[0.18em] text-signal uppercase">Le studio</p>
          <ul className="space-y-2 text-sm text-paper/70">
            <li><Link href="/fonctionnalites" className="hover:text-paper">Fonctionnalités</Link></li>
            <li><Link href="/tarifs" className="hover:text-paper">Tarifs</Link></li>
            <li><Link href="/#destinations" className="hover:text-paper">Réseaux pris en charge</Link></li>
            <li><Link href="/#questions" className="hover:text-paper">Questions fréquentes</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-board text-xs tracking-[0.18em] text-signal uppercase">Votre compte</p>
          <ul className="space-y-2 text-sm text-paper/70">
            <li><Link href="/inscription" className="hover:text-paper">Créer un compte</Link></li>
            <li><Link href="/connexion" className="hover:text-paper">Se connecter</Link></li>
            <li><Link href="/mot-de-passe-oublie" className="hover:text-paper">Mot de passe oublié</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 font-board text-[11px] tracking-[0.12em] text-paper/40 uppercase sm:flex-row sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Studio Marketing IA</span>
          <span>Mentions légales, confidentialité et conditions d&apos;utilisation : en préparation</span>
        </div>
      </div>
    </footer>
  );
}
