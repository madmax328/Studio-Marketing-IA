import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteFontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
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
