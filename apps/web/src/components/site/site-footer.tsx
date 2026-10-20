import Link from "next/link";
import { SiteLogo } from "./site-header";

const COLUMNS = [
  {
    title: "Produit",
    links: [
      { href: "/#comment", label: "Comment ça marche" },
      { href: "/fonctionnalites", label: "Fonctionnalités" },
      { href: "/#reseaux", label: "Réseaux" },
      { href: "/tarifs", label: "Tarifs" },
    ],
  },
  {
    title: "Aide",
    links: [
      { href: "/#questions", label: "Questions fréquentes" },
      { href: "/mot-de-passe-oublie", label: "Mot de passe oublié" },
    ],
  },
  {
    title: "Légal",
    links: [
      { href: "/mentions-legales", label: "Mentions légales" },
      { href: "/conditions", label: "Conditions générales" },
      { href: "/confidentialite", label: "Confidentialité" },
      { href: "/suppression-des-donnees", label: "Suppression des données" },
    ],
  },
  {
    title: "Compte",
    links: [
      { href: "/inscription", label: "Créer un compte" },
      { href: "/connexion", label: "Se connecter" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="space-y-4">
          <SiteLogo />
          <p className="max-w-xs text-sm leading-relaxed text-fg-muted">
            Écrit, crée et publie vos réseaux sociaux à partir de ce que vous lui avez appris de votre activité.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="text-sm font-medium">{column.title}</p>
            <ul className="mt-4 space-y-3 text-sm text-fg-muted">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-fg">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-fg-dim sm:flex-row sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Studio Marketing IA</span>
          <span>Aucun cookie publicitaire, aucune donnée revendue.</span>
        </div>
      </div>
    </footer>
  );
}
