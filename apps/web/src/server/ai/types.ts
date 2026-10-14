import type { BrandInput, GenerationOutput, PostKind, SocialNetworkId } from "@smia/shared";

export interface TextGenerationInput {
  brand: BrandInput;
  networks: SocialNetworkId[];
  kind: PostKind;
  brief: string;
  tone: BrandInput["tone"];
  variantsPerNetwork: number;
}

export interface TextGenerationResult {
  output: GenerationOutput;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Interface commune à tous les fournisseurs de génération de texte (cloud ou local).
 * Ajouter un fournisseur = implémenter cette interface et l'enregistrer dans ./index.ts.
 */
export interface TextGenerationProvider {
  id: string;
  /** Nom affiché à l'utilisateur, notamment pour l'informer de l'envoi de ses données. */
  label: string;
  /** Société qui traite les données (information RGPD). */
  dataProcessor: string;
  /** Le fournisseur est-il configuré (clé, service local joignable…) ? */
  isConfigured(): boolean;
  generatePosts(input: TextGenerationInput): Promise<TextGenerationResult>;
}

/** Erreur du fournisseur, avec un message compréhensible par l'utilisateur. */
export class TextGenerationError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TextGenerationError";
  }
}
