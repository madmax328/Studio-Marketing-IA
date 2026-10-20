import Link from "next/link";
import { SiteLogo } from "./site-header";

export function SiteFooter() {
  return (
    <footer className="bg-ink text-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <SiteLogo tone="light" />
          <p className="max-w-sm text-sm text-cream/60">
            Le studio qui écrit, programme et publie vos réseaux sociaux à partir de ce que vous lui avez appris de votre
            activité.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Découvrir</p>
          <ul className="space-y-2 text-sm text-cream/70">
            <li><Link href="/#comment" className="hover:text-cream">Comment ça marche</Link></li>
            <li><Link href="/fonctionnalites" className="hover:text-cream">Fonctionnalités</Link></li>
            <li><Link href="/tarifs" className="hover:text-cream">Tarifs</Link></li>
            <li><Link href="/#reseaux" className="hover:text-cream">Réseaux pris en charge</Link></li>
            <li><Link href="/#questions" className="hover:text-cream">Questions fréquentes</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Votre compte</p>
          <ul className="space-y-2 text-sm text-cream/70">
            <li><Link href="/inscription" className="hover:text-cream">Créer un compte</Link></li>
            <li><Link href="/connexion" className="hover:text-cream">Se connecter</Link></li>
            <li><Link href="/mot-de-passe-oublie" className="hover:text-cream">Mot de passe oublié</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-cream/45 sm:flex-row sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Studio Marketing IA</span>
          <span>Mentions légales, confidentialité et conditions d&apos;utilisation : en préparation</span>
        </div>
      </div>
    </footer>
  );
}
