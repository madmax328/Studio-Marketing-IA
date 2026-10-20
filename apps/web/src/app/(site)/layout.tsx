import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site flex min-h-screen flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-tomato focus:px-3 focus:py-2 focus:text-ink">
        Aller au contenu
      </a>
      <SiteHeader />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
