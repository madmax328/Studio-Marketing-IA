import Link from "next/link";
import { SignOutButton } from "@/components/app/sign-out-button";

const NAVIGATION = [
  { href: "/tableau-de-bord", label: "Tableau de bord" },
  { href: "/campagnes", label: "Campagnes" },
  { href: "/calendrier", label: "Calendrier" },
  { href: "/studio", label: "Studio de contenu" },
  { href: "/publications", label: "Publications" },
  { href: "/medias", label: "Médiathèque" },
  { href: "/ma-marque", label: "Ma marque" },
  { href: "/reseaux", label: "Réseaux sociaux" },
  { href: "/parametres", label: "Paramètres" },
];

/** Modules de la V1 pas encore livrés : affichés comme tels, sans lien factice. */
const UPCOMING = ["Vidéos", "Statistiques"];

export function Sidebar({ userName, workspaceName, unreadAlerts }: { userName: string; workspaceName: string; unreadAlerts: number }) {
  return (
    <aside className="flex w-full flex-col gap-6 border-b border-border bg-surface p-4 md:min-h-screen md:w-64 md:border-r md:border-b-0">
      <div>
        <p className="font-semibold">Studio Marketing IA</p>
        <p className="truncate text-xs text-muted">{workspaceName}</p>
      </div>
      <nav aria-label="Navigation principale" className="flex flex-wrap gap-1 md:flex-col">
        {NAVIGATION.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm hover:bg-background">
            {item.label}
          </Link>
        ))}
        <Link href="/notifications" className="rounded-lg px-3 py-2 text-sm hover:bg-background">
          Alertes
          {unreadAlerts > 0 ? (
            <span className="ml-2 rounded-full bg-danger px-2 text-xs text-white" aria-label={`${unreadAlerts} non lues`}>
              {unreadAlerts}
            </span>
          ) : null}
        </Link>
      </nav>
      <div className="hidden md:block">
        <p className="px-3 text-xs font-medium tracking-wide text-muted uppercase">Bientôt</p>
        <ul className="mt-1">
          {UPCOMING.map((label) => (
            <li key={label} className="px-3 py-1.5 text-sm text-muted">
              {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto space-y-1 border-t border-border pt-4">
        <p className="truncate px-3 text-sm">{userName}</p>
        <SignOutButton />
      </div>
    </aside>
  );
}
