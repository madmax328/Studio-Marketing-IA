import Link from "next/link";

const NAV = [
  { href: "/#comment", label: "Comment ça marche" },
  { href: "/fonctionnalites", label: "Fonctionnalités" },
  { href: "/#pour-qui", label: "Pour qui ?" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/#questions", label: "Questions" },
];

export function SiteLogo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const ink = tone === "dark" ? "#17140f" : "#faf7f2";
  return (
    <span className="inline-flex items-center gap-2">
      {/* Bulle de publication avec un éclat : « ça se publie tout seul ». */}
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
        <path d="M5 6h22a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H14l-6 5v-5H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" fill="#ec5a34" stroke={ink} strokeWidth="1.5" />
        <path d="M16 9.5l1.3 3.2 3.2 1.3-3.2 1.3L16 18.5l-1.3-3.2-3.2-1.3 3.2-1.3z" fill={tone === "dark" ? "#faf7f2" : "#17140f"} />
      </svg>
      <span className={`text-lg leading-none font-semibold tracking-tight ${tone === "dark" ? "text-ink" : "text-cream"}`}>
        Studio Marketing <span className="font-serif text-xl italic">IA</span>
      </span>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Studio Marketing IA, accueil">
          <SiteLogo />
        </Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-6 text-sm lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-ink-soft transition hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/connexion" className="hidden rounded-full px-4 py-2 text-sm text-ink-soft hover:text-ink sm:inline-block">
            Se connecter
          </Link>
          <Link
            href="/inscription"
            className="rounded-full border-[1.5px] border-ink bg-tomato px-4 py-2 text-sm font-semibold text-ink shadow-[2px_2px_0_#17140f] transition hover:translate-x-px hover:translate-y-px hover:shadow-[1px_1px_0_#17140f]"
          >
            <span className="sm:hidden">Créer un compte</span>
            <span className="hidden sm:inline">Créer mon compte gratuit</span>
          </Link>
        </div>
      </div>
      <nav aria-label="Navigation mobile" className="flex gap-5 overflow-x-auto border-t border-ink/5 px-4 py-2 text-sm lg:hidden">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="shrink-0 text-ink-soft hover:text-ink">
            {item.label}
          </Link>
        ))}
        <Link href="/connexion" className="shrink-0 text-ink-soft hover:text-ink sm:hidden">
          Se connecter
        </Link>
      </nav>
    </header>
  );
}
