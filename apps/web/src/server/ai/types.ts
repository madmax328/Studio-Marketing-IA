import type {
  BrandInput,
  CampaignObjective,
  CampaignPostsOutput,
  GenerationOutput,
  PostKind,
  SocialNetworkId,
  StrategyOutput,
} from "@smia/shared";

export interface TextGenerationInput {
  brand: BrandInput;
  networks: SocialNetworkId[];
  kind: PostKind;
  brief: string;
  tone: BrandInput["tone"];
  variantsPerNetwork: number;
}

export interface ProviderResult<T> {
  output: T;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

export type TextGenerationResult = ProviderResult<GenerationOutput>;

export interface CampaignContext {
  brand: BrandInput;
  name: string;
  objective: CampaignObjective;
  networks: SocialNetworkId[];
  highlights: string;
  startDate: string;
  endDate: string;
}

export interface StrategyInput extends CampaignContext {
  /** Créneaux déjà datés par l'application ; l'IA choisit le sujet de chacun. */
  slots: { index: number; date: string; weekday: string }[];
}

export interface CampaignPostsInput extends CampaignContext {
  summary: string;
  keyMessages: string[];
  slots: { index: number; date: string; theme: string; kind: PostKind; role: string }[];
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
  generateCampaignStrategy(input: StrategyInput): Promise<ProviderResult<StrategyOutput>>;
  generateCampaignPosts(input: CampaignPostsInput): Promise<ProviderResult<CampaignPostsOutput>>;
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
