"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/#comment", label: "Comment ça marche" },
  { href: "/fonctionnalites", label: "Fonctionnalités" },
  { href: "/#reseaux", label: "Réseaux" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/#questions", label: "Questions" },
];

export function SiteLogo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id="logo-sun" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffc56b" />
            <stop offset="0.55" stopColor="#ff7a45" />
            <stop offset="1" stopColor="#ff4f6d" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="26" height="26" rx="8" fill="url(#logo-sun)" />
        <path d="M8 18.5c2.2-5.8 4.4-8.7 6.6-8.7 1.9 0 2.4 2.6 3.7 2.6.9 0 1.6-.7 1.7-1.9" fill="none" stroke="#07080b" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="20" cy="18.5" r="1.6" fill="#07080b" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-fg">Studio Marketing IA</span>
    </span>
  );
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header className={cn("sticky top-0 z-40 transition-colors duration-300", scrolled ? "border-b border-line bg-void/75 backdrop-blur-xl" : "border-b border-transparent")}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Studio Marketing IA, accueil">
          <SiteLogo />
        </Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-7 text-sm lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-fg-muted transition hover:text-fg">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Link href="/connexion" className="rounded-full px-3.5 py-2 text-sm text-fg-muted transition hover:text-fg">
            Se connecter
          </Link>
          <Link href="/inscription" className="hidden rounded-full bg-fg px-4 py-2 text-sm font-medium text-void transition hover:bg-white sm:inline-block">
            Créer un compte
          </Link>
        </div>
      </div>
      <nav aria-label="Navigation mobile" className="flex gap-5 overflow-x-auto px-4 pb-3 text-sm lg:hidden">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="shrink-0 text-fg-muted hover:text-fg">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
