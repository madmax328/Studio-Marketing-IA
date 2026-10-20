import { Big_Shoulders, Instrument_Sans, JetBrains_Mono } from "next/font/google";

/** Signalétique d'aéroport : titres condensés, tableau des départs en chasse fixe, texte courant lisible. */
export const displayFont = Big_Shoulders({ subsets: ["latin"], weight: "variable", variable: "--nf-display", display: "swap" });
export const boardFont = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--nf-board", display: "swap" });
export const bodyFont = Instrument_Sans({ subsets: ["latin"], weight: "variable", variable: "--nf-body", display: "swap" });

export const siteFontVariables = `${displayFont.variable} ${boardFont.variable} ${bodyFont.variable}`;
