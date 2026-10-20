"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/app/sign-out-button";
import { SiteLogo } from "@/components/site/site-header";
import { cn } from "@/lib/cn";
import { NAV_ICONS, type NavIconName } from "./nav-icons";

const GROUPS: { title: string; items: { href: string; label: string; icon: NavIconName }[] }[] = [
  {
    title: "Créer",
    items: [
      { href: "/tableau-de-bord", label: "Tableau de bord", icon: "dashboard" },
      { href: "/studio", label: "Studio de contenu", icon: "studio" },
      { href: "/campagnes", label: "Campagnes", icon: "campaigns" },
      { href: "/medias", label: "Médiathèque", icon: "media" },
    ],
  },
  {
    title: "Publier",
    items: [
      { href: "/publications", label: "Publications", icon: "posts" },
      { href: "/calendrier", label: "Calendrier", icon: "calendar" },
      { href: "/reseaux", label: "Réseaux sociaux", icon: "networks" },
    ],
  },
  {
    title: "Compte",
    items: [
      { href: "/ma-marque", label: "Ma marque", icon: "brand" },
      { href: "/abonnement", label: "Abonnement", icon: "billing" },
      { href: "/parametres", label: "Paramètres", icon: "settings" },
    ],
  },
];

/** Modules de la V1 pas encore livrés : affichés comme tels, sans lien factice. */
const UPCOMING = ["Vidéos"];

function NavLink({ href, label, icon, active, badge }: { href: string; label: string; icon: NavIconName; active: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
        active ? "bg-white/[0.07] text-foreground" : "text-muted hover:bg-white/[0.04] hover:text-foreground",
      )}
    >
      {active ? <span aria-hidden="true" className="absolute top-2 bottom-2 -left-3 hidden w-0.5 rounded-full bg-primary md:block" /> : null}
      <span className={cn(active ? "text-primary" : "text-muted group-hover:text-foreground")}>{NAV_ICONS[icon]}</span>
      {label}
      {badge && badge > 0 ? (
        <span className="ml-auto rounded-full bg-primary px-1.5 py-px font-mono text-[10px] text-primary-foreground" aria-label={`${badge} non lues`}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({ userName, workspaceName, unreadAlerts }: { userName: string; workspaceName: string; unreadAlerts: number }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const initials = userName
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="sticky top-0 z-30 flex w-full flex-col border-b border-border bg-background/85 backdrop-blur-xl md:h-screen md:w-64 md:shrink-0 md:border-r md:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 md:px-5 md:pt-6">
        <Link href="/tableau-de-bord" aria-label="Tableau de bord">
          <SiteLogo />
        </Link>
        <div className="md:hidden">
          <SignOutButton compact />
        </div>
      </div>
      <p className="hidden truncate px-5 text-xs text-muted md:block">{workspaceName}</p>

      <nav aria-label="Navigation principale" className="flex gap-1 overflow-x-auto px-3 pb-3 md:mt-6 md:flex-1 md:flex-col md:gap-6 md:overflow-y-auto md:px-5 md:pb-0">
        {GROUPS.map((group) => (
          <div key={group.title} className="flex gap-1 md:flex-col md:gap-0.5">
            <p className="hidden px-3 pb-1.5 font-mono text-[10px] tracking-[0.14em] text-muted/70 uppercase md:block">{group.title}</p>
            {group.items.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} />
            ))}
          </div>
        ))}
        <div className="flex gap-1 md:flex-col md:gap-0.5">
          <p className="hidden px-3 pb-1.5 font-mono text-[10px] tracking-[0.14em] text-muted/70 uppercase md:block">Suivi</p>
          <NavLink href="/statistiques" label="Statistiques" icon="stats" active={isActive("/statistiques")} />
          <NavLink href="/notifications" label="Alertes" icon="alerts" active={isActive("/notifications")} badge={unreadAlerts} />
          {UPCOMING.map((label) => (
            <span key={label} className="hidden items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted/50 md:flex">
              {NAV_ICONS.soon}
              {label}
              <span className="ml-auto rounded-full border border-border px-1.5 py-px font-mono text-[9px] tracking-wide uppercase">Bientôt</span>
            </span>
          ))}
        </div>
      </nav>

      <div className="hidden border-t border-border p-4 md:block">
        <div className="flex items-center gap-3 px-1 pb-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#ffc56b] via-primary to-[#ff4f6d] text-xs font-semibold text-background">
            {initials || "?"}
          </span>
          <span className="truncate text-sm">{userName}</span>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
