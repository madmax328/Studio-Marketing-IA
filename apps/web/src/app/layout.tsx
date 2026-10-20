import type { Metadata } from "next";
import type { ReactNode } from "react";
import { publicSiteUrl } from "@/lib/site-url";
import { siteFontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl()),
  openGraph: { type: "website", locale: "fr_FR", siteName: "Studio Marketing IA" },
  title: { default: "Studio Marketing IA", template: "%s · Studio Marketing IA" },
  description: "Créez, publiez et améliorez vos publications sur les réseaux sociaux grâce à l'IA.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={siteFontVariables}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
