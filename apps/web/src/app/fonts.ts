import { Geist, Geist_Mono } from "next/font/google";

/** Site public : grotesque précise pour les titres et le texte, chasse fixe pour les détails d'interface. */
export const sansFont = Geist({ subsets: ["latin"], weight: "variable", variable: "--nf-sans", display: "swap" });
export const monoFont = Geist_Mono({ subsets: ["latin"], weight: "variable", variable: "--nf-mono", display: "swap" });

export const siteFontVariables = `${sansFont.variable} ${monoFont.variable}`;
