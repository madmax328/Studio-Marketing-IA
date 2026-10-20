import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default function NotFound() {
  return (
    <div className="site flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="relative overflow-x-clip">
          <div
            aria-hidden="true"
            className="halo pointer-events-none absolute inset-x-0 -top-16 h-[30rem]"
          />
          <div className="relative mx-auto max-w-2xl px-4 py-32 text-center sm:px-6">
            <p className="font-mono text-xs tracking-[0.14em] text-solar uppercase">
              Erreur 404
            </p>
            <h1 className="mt-4 text-5xl font-semibold tracking-[-0.045em]">
              Cette page n&apos;existe pas.
            </h1>
            <p className="mt-5 text-fg-muted">
              Le lien est peut-être incomplet, ou la page a été déplacée.
            </p>
            <Link
              href="/"
              className="mt-9 inline-block rounded-full bg-fg px-6 py-3 text-sm font-medium text-void hover:bg-white"
            >
              Revenir à l&apos;accueil
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
