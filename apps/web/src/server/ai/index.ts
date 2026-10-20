import "server-only";
import { getServerEnv } from "@/server/env";
import { anthropicTextProvider } from "./anthropic";
import { createOpenAiImageProvider } from "./openai-image";
import { createOpenAiSpeechProvider } from "./openai-speech";
import { createOpenAiVideoProvider } from "./openai-video";
import type { ImageGenerationProvider, SpeechGenerationProvider, TextGenerationProvider, VideoGenerationProvider } from "./types";

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

const speechProvider = createOpenAiSpeechProvider();

/** Fournisseur de voix off (inactif tant que la clé OpenAI n'est pas renseignée). */
export function getSpeechProvider(): SpeechGenerationProvider {
  return speechProvider;
}

const videoProvider = createOpenAiVideoProvider();

/** Fournisseur de vidéos par IA (inactif tant que la clé OpenAI n'est pas renseignée). */
export function getVideoProvider(): VideoGenerationProvider {
  return videoProvider;
}

export type { ImageGenerationProvider, SpeechGenerationProvider, TextGenerationProvider, VideoGenerationProvider } from "./types";
