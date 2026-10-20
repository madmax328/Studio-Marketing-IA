import { Instrument_Sans, Instrument_Serif } from "next/font/google";

/** Site public : grands titres à empattements (italique pour les mots clés), texte courant très lisible. */
export const serifFont = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--nf-serif", display: "swap" });
export const bodyFont = Instrument_Sans({ subsets: ["latin"], weight: "variable", variable: "--nf-body", display: "swap" });

export const siteFontVariables = `${serifFont.variable} ${bodyFont.variable}`;
