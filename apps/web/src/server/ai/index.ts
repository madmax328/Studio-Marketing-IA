import "server-only";
import { getServerEnv } from "@/server/env";
import { anthropicTextProvider } from "./anthropic";
import { createOpenAiImageProvider } from "./openai-image";
import type { ImageGenerationProvider, TextGenerationProvider } from "./types";

const TEXT_PROVIDERS: Record<string, TextGenerationProvider> = {
  anthropic: anthropicTextProvider,
};

/** Fournisseur de texte choisi par AI_TEXT_PROVIDER. Le mode local s'ajoutera ici. */
export function getTextProvider(): TextGenerationProvider {
  const provider = TEXT_PROVIDERS[getServerEnv().AI_TEXT_PROVIDER];
  if (!provider) throw new Error("Fournisseur de texte inconnu.");
  return provider;
}

const IMAGE_PROVIDERS: Record<string, ImageGenerationProvider> = {
  openai: createOpenAiImageProvider(),
};

/** Fournisseur d'images choisi par AI_IMAGE_PROVIDER (inactif tant que sa clé n'est pas renseignée). */
export function getImageProvider(): ImageGenerationProvider {
  const provider = IMAGE_PROVIDERS[getServerEnv().AI_IMAGE_PROVIDER];
  if (!provider) throw new Error("Fournisseur d'images inconnu.");
  return provider;
}

export type { ImageGenerationProvider, TextGenerationProvider } from "./types";
