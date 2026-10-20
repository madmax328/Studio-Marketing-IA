import Link from "next/link";

const NAV = [
  { href: "/#boucle", label: "Fonctionnement" },
  { href: "/fonctionnalites", label: "Fonctionnalités" },
  { href: "/#destinations", label: "Réseaux" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/#questions", label: "Questions" },
];

export function SiteLogo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {/* Horizon artificiel : symbole du pilote automatique. */}
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
        <circle cx="16" cy="16" r="15" fill="#0b0e13" stroke="#ffc619" strokeWidth="2" />
        <path d="M1.5 18.5h29a15 15 0 0 1-29 0Z" fill="#ffc619" />
        <path d="M7 16h6l3 3 3-3h6" fill="none" stroke="#f2eee3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`font-display text-xl leading-none font-extrabold tracking-wide uppercase ${tone === "light" ? "text-paper" : "text-ink"}`}>
        Studio Marketing <span className="text-signal-dim">IA</span>
      </span>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-night/90 text-paper backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Studio Marketing IA, accueil">
          <SiteLogo tone="light" />
        </Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-6 font-board text-xs tracking-[0.14em] uppercase lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-paper/70 transition hover:text-signal">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/connexion" className="hidden rounded-full px-4 py-2 text-sm text-paper/80 hover:text-paper sm:inline-block">
            Se connecter
          </Link>
          <Link
            href="/inscription"
            className="rounded-full bg-signal px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            Embarquer
          </Link>
        </div>
      </div>
      <nav aria-label="Navigation mobile" className="flex gap-5 overflow-x-auto border-t border-white/5 px-4 py-2 font-board text-[11px] tracking-[0.12em] uppercase lg:hidden">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="shrink-0 text-paper/70 hover:text-signal">
            {item.label}
          </Link>
        ))}
        <Link href="/connexion" className="shrink-0 text-paper/70 hover:text-signal sm:hidden">
          Connexion
        </Link>
      </nav>
    </header>
  );
}
