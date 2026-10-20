import Link from "next/link";
import type { ReactNode } from "react";
import { legalDate } from "@/lib/legal";

const DOCUMENTS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/conditions", label: "Conditions générales" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/suppression-des-donnees", label: "Suppression des données" },
];

/** Gabarit des pages légales : sommaire des documents, titre, date de mise à jour, texte lisible. */
export function LegalPage({ title, intro, current, children }: { title: string; intro?: ReactNode; current: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-16 pb-24 sm:px-6 sm:pt-20 lg:grid-cols-[14rem_1fr]">
      <nav aria-label="Documents légaux" className="lg:sticky lg:top-24 lg:self-start">
        <p className="font-mono text-xs tracking-[0.14em] text-solar uppercase">Documents</p>
        <ul className="mt-4 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {DOCUMENTS.map((doc) => (
            <li key={doc.href}>
              <Link
                href={doc.href}
                aria-current={doc.href === current ? "page" : undefined}
                className={
                  doc.href === current
                    ? "block rounded-lg bg-white/[0.07] px-3 py-1.5 text-sm text-fg"
                    : "block rounded-lg px-3 py-1.5 text-sm text-fg-muted transition hover:text-fg"
                }
              >
                {doc.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="legal min-w-0 max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-fg-dim">Dernière mise à jour : {legalDate()}</p>
        {intro ? <div className="mt-6 text-lg leading-relaxed text-fg-muted">{intro}</div> : null}
        <div className="mt-10">{children}</div>
      </article>
    </div>
  );
}
