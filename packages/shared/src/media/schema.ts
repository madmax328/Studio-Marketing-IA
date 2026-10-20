import { z } from "zod";

/** Formats d'image proposés, adaptés aux réseaux sociaux. */
export const IMAGE_FORMATS = {
  square: { label: "Carré (1:1)", width: 1080, height: 1080 },
  portrait: { label: "Portrait (4:5)", width: 1080, height: 1350 },
  story: { label: "Vertical (9:16)", width: 1080, height: 1920 },
  landscape: { label: "Paysage (16:9)", width: 1920, height: 1080 },
} as const;

export type ImageFormatId = keyof typeof IMAGE_FORMATS;
export const IMAGE_FORMAT_IDS = Object.keys(IMAGE_FORMATS) as ImageFormatId[];

/** Gabarits de visuels : le texte, le logo et les couleurs sont incrustés exactement, jamais « dessinés » par une IA. */
export const TEMPLATE_IDS = ["photo_bandeau", "couleur_titre", "promo", "citation"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const TEMPLATE_LABELS: Record<TemplateId, { label: string; description: string; needsPhoto: boolean }> = {
  photo_bandeau: { label: "Photo + bandeau", description: "Votre photo avec un titre dans un bandeau aux couleurs de la marque.", needsPhoto: true },
  couleur_titre: { label: "Titre sur couleur", description: "Un grand titre sur la couleur principale de la marque.", needsPhoto: false },
  promo: { label: "Annonce", description: "Pour une offre ou une nouveauté : titre très visible et sous-titre.", needsPhoto: false },
  citation: { label: "Conseil / citation", description: "Un conseil ou une phrase mise en valeur, avec le nom de la marque.", needsPhoto: false },
};

/** Types de fichiers acceptés à l'envoi. Le type réel est revérifié côté serveur. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const templateRenderSchema = z.object({
  brandId: z.string().min(1, "Choisissez une marque"),
  templateId: z.enum(TEMPLATE_IDS),
  format: z.enum(IMAGE_FORMAT_IDS as [ImageFormatId, ...ImageFormatId[]]),
  title: z.string().trim().min(1, "Le titre est obligatoire").max(120, "Titre trop long (120 caractères maximum)"),
  subtitle: z.string().trim().max(200, "Sous-titre trop long (200 caractères maximum)").default(""),
  backgroundMediaId: z.string().optional(),
  showLogo: z.boolean().default(true),
  /** Couleur principale ; par défaut la première couleur de la marque. */
  color: hexColor.optional(),
});

export type TemplateRenderInput = z.infer<typeof templateRenderSchema>;

/** Couleur de texte lisible (noir ou blanc) sur un fond donné. */
export function readableTextColor(background: string): "#111111" | "#ffffff" {
  const hex = background.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.4 ? "#111111" : "#ffffff";
}

/** Styles proposés pour les images créées par IA. */
export const IMAGE_STYLES = ["photo", "illustration", "minimaliste"] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];
export const IMAGE_STYLE_LABELS: Record<ImageStyle, string> = {
  photo: "Photo réaliste",
  illustration: "Illustration",
  minimaliste: "Minimaliste",
};

/** Demande de création d'image par IA (validée côté serveur). */
export const imageGenerationRequestSchema = z.object({
  requestId: z.uuid("Demande invalide."),
  brandId: z.string().regex(/^[a-f0-9]{24}$/, "Marque invalide."),
  description: z
    .string()
    .trim()
    .min(8, "Décrivez l'image en quelques mots (8 caractères au moins).")
    .max(800, "Description trop longue (800 caractères au plus)."),
  format: z.enum(IMAGE_FORMAT_IDS as [ImageFormatId, ...ImageFormatId[]]),
  style: z.enum(IMAGE_STYLES).default("photo"),
});
export type ImageGenerationRequest = z.infer<typeof imageGenerationRequestSchema>;

// ---------- Vidéos ----------

/** Les vidéos sont montées dans le navigateur (H.264 dans un MP4), puis vérifiées par le serveur. */
export const ACCEPTED_VIDEO_TYPES = ["video/mp4"] as const;
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
/** Durée maximale d'une vidéo créée dans le studio (secondes). */
export const MAX_VIDEO_SECONDS = 60;
export const MAX_VIDEO_SLIDES = 8;
export const VIDEO_SLIDE_SECONDS = { min: 2, max: 6, default: 3 } as const;

export const VIDEO_TRANSITIONS = ["fondu", "glissement", "coupe"] as const;
export type VideoTransition = (typeof VIDEO_TRANSITIONS)[number];
export const VIDEO_TRANSITION_LABELS: Record<VideoTransition, string> = {
  fondu: "Fondu",
  glissement: "Glissement",
  coupe: "Coupe franche",
};

/** Formats proposés pour les vidéos (mêmes dimensions que les visuels). Le vertical convient aux Reels et Shorts. */
export const VIDEO_FORMAT_IDS: readonly ImageFormatId[] = ["story", "portrait", "square", "landscape"];

/** Nature d'un média joint à une publication. */
export type MediaKindId = "image" | "video";

// ---------- Voix off ----------

/** Voix proposées pour la voix off (identifiants du fournisseur ; libellés descriptifs). */
export const VOICEOVER_VOICES = ["coral", "nova", "sage", "ash", "onyx"] as const;
export type VoiceoverVoice = (typeof VOICEOVER_VOICES)[number];
export const VOICEOVER_VOICE_LABELS: Record<VoiceoverVoice, string> = {
  coral: "Claire et chaleureuse",
  nova: "Vive et souriante",
  sage: "Posée",
  ash: "Grave et assurée",
  onyx: "Très grave",
};
/** Texte lu sur une diapositive : environ 20 secondes de parole au plus. */
export const MAX_VOICEOVER_LINE = 300;

/** Demande de voix off pour une vidéo du studio (validée côté serveur). */
export const voiceoverRequestSchema = z.object({
  requestId: z.uuid("Demande invalide."),
  brandId: z.string().regex(/^[a-f0-9]{24}$/, "Marque invalide."),
  voice: z.enum(VOICEOVER_VOICES).default("coral"),
  lines: z
    .array(
      z.object({
        slide: z.number().int().min(0).max(MAX_VIDEO_SLIDES - 1),
        text: z.string().trim().min(1, "Texte de voix off vide.").max(MAX_VOICEOVER_LINE, `Voix off trop longue (${MAX_VOICEOVER_LINE} caractères au plus par diapositive).`),
      }),
    )
    .min(1, "Écrivez le texte à lire sur au moins une diapositive.")
    .max(MAX_VIDEO_SLIDES),
});
export type VoiceoverRequest = z.infer<typeof voiceoverRequestSchema>;

// ---------- Vidéos par IA ----------

/** Durées proposées pour une vidéo créée par IA (secondes) ; le coût en crédits dépend de la durée. */
export const AI_VIDEO_SECONDS = [4, 8] as const;
export type AiVideoSeconds = (typeof AI_VIDEO_SECONDS)[number];
/** Orientations proposées (dimensions produites par le fournisseur). */
export const AI_VIDEO_ORIENTATIONS = ["vertical", "horizontal"] as const;
export type AiVideoOrientation = (typeof AI_VIDEO_ORIENTATIONS)[number];
export const AI_VIDEO_ORIENTATION_LABELS: Record<AiVideoOrientation, string> = {
  vertical: "Verticale 9:16 (Reels, TikTok, Shorts)",
  horizontal: "Horizontale 16:9 (YouTube, LinkedIn)",
};

/** Demande de vidéo par IA (validée côté serveur). */
export const videoGenerationRequestSchema = z.object({
  requestId: z.uuid("Demande invalide."),
  brandId: z.string().regex(/^[a-f0-9]{24}$/, "Marque invalide."),
  description: z
    .string()
    .trim()
    .min(15, "Décrivez la scène en une phrase au moins (15 caractères).")
    .max(1000, "Description trop longue (1000 caractères au plus)."),
  orientation: z.enum(AI_VIDEO_ORIENTATIONS).default("vertical"),
  seconds: z.union([z.literal(4), z.literal(8)]).default(4),
});
export type VideoGenerationRequest = z.infer<typeof videoGenerationRequestSchema>;
