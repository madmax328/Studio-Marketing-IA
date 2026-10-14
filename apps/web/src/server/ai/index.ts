import "server-only";
import { getServerEnv } from "@/server/env";
import { anthropicTextProvider } from "./anthropic";
import type { TextGenerationProvider } from "./types";

const TEXT_PROVIDERS: Record<string, TextGenerationProvider> = {
  anthropic: anthropicTextProvider,
};

/** Fournisseur de texte choisi par AI_TEXT_PROVIDER. Le mode local s'ajoutera ici. */
export function getTextProvider(): TextGenerationProvider {
  const provider = TEXT_PROVIDERS[getServerEnv().AI_TEXT_PROVIDER];
  if (!provider) throw new Error("Fournisseur de texte inconnu.");
  return provider;
}

export type { TextGenerationProvider } from "./types";
