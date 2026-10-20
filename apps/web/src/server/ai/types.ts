import type {
  BrandInput,
  CampaignObjective,
  CampaignPostsOutput,
  GenerationOutput,
  PostKind,
  SocialNetworkId,
  StrategyOutput,
} from "@smia/shared";

/** Publication réelle de la marque qui a bien marché (boucle d'amélioration). */
export interface PastPerformance {
  network: SocialNetworkId;
  text: string;
  engagement: number;
}

export interface TextGenerationInput {
  brand: BrandInput;
  networks: SocialNetworkId[];
  kind: PostKind;
  brief: string;
  tone: BrandInput["tone"];
  variantsPerNetwork: number;
  /** Meilleures publications passées de la marque, d'après les chiffres des réseaux. */
  pastPerformance?: PastPerformance[];
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
  pastPerformance?: PastPerformance[];
}

/** Ce que tout fournisseur d'IA expose (accord RGPD, disponibilité). */
export interface AiProviderInfo {
  id: string;
  /** Nom affiché à l'utilisateur, notamment pour l'informer de l'envoi de ses données. */
  label: string;
  /** Société qui traite les données (information RGPD). */
  dataProcessor: string;
  /** Le fournisseur est-il configuré (clé, service local joignable…) ? */
  isConfigured(): boolean;
}

/** Image produite par un fournisseur (PNG ou JPEG brut). */
export interface ImageGenerationInput {
  prompt: string;
  orientation: "square" | "portrait" | "landscape";
}

/**
 * Fournisseur de création d'images. L'image ne contient jamais de texte ni de logo :
 * ils sont ajoutés ensuite par les modèles de visuels, avec les vraies informations de la marque.
 */
export interface ImageGenerationProvider extends AiProviderInfo {
  generateImage(input: ImageGenerationInput): Promise<ProviderResult<Buffer>>;
}

/**
 * Interface commune à tous les fournisseurs de génération de texte (cloud ou local).
 * Ajouter un fournisseur = implémenter cette interface et l'enregistrer dans ./index.ts.
 */
export interface TextGenerationProvider extends AiProviderInfo {
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
