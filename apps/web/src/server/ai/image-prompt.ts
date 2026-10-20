import { IMAGE_FORMATS, type BrandInput, type ImageFormatId, type ImageStyle } from "@smia/shared";

const STYLE_HINTS: Record<ImageStyle, string> = {
  photo: "Photographie réaliste et soignée, lumière naturelle, cadrage professionnel.",
  illustration: "Illustration moderne et chaleureuse, formes nettes, couleurs harmonieuses.",
  minimaliste: "Composition minimaliste, beaucoup d'espace vide, fond uni ou très simple, un seul sujet.",
};

/**
 * Consigne envoyée au service d'images. Seuls le secteur, les couleurs de la marque et la description de
 * l'utilisateur sont transmis. L'image ne doit contenir ni texte ni logo : ils sont ajoutés ensuite par les
 * modèles de visuels, avec les vraies informations de la marque.
 */
export function buildImagePrompt(brand: Pick<BrandInput, "industry" | "brandColors">, input: { description: string; format: ImageFormatId; style: ImageStyle }): string {
  const format = IMAGE_FORMATS[input.format];
  return [
    `Image pour une publication sur les réseaux sociaux${brand.industry ? ` (secteur : ${brand.industry})` : ""}.`,
    `Sujet : ${input.description.replace(/\s+/g, " ").trim()}`,
    STYLE_HINTS[input.style],
    brand.brandColors.length > 0 ? `Palette en accord avec ces couleurs : ${brand.brandColors.slice(0, 4).join(", ")}.` : "",
    `Format final : ${format.width} × ${format.height} pixels ; garder le sujet principal au centre.`,
    "Impératif : aucun texte, aucune lettre, aucun chiffre, aucun logo, aucune marque ni signature dans l'image.",
    "Pas de personne réelle connue ; si des personnes apparaissent, elles sont anonymes et naturelles.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Orientation demandée au fournisseur ; l'image est ensuite recadrée au format exact. */
export function orientationFor(format: ImageFormatId): "square" | "portrait" | "landscape" {
  const { width, height } = IMAGE_FORMATS[format];
  if (width === height) return "square";
  return width > height ? "landscape" : "portrait";
}

/**
 * Consigne envoyée au service de vidéos : même principe que les images (secteur, couleurs, description), sans texte
 * ni logo à l'écran ; le nom et les informations de la marque restent ceux que l'utilisateur ajoute lui-même.
 */
export function buildVideoPrompt(brand: Pick<BrandInput, "industry" | "brandColors">, input: { description: string; orientation: "vertical" | "horizontal"; seconds: number }): string {
  return [
    `Courte vidéo de ${input.seconds} secondes pour les réseaux sociaux${brand.industry ? ` (secteur : ${brand.industry})` : ""}, format ${input.orientation === "vertical" ? "vertical 9:16" : "horizontal 16:9"}.`,
    `Scène : ${input.description.replace(/\s+/g, " ").trim()}`,
    "Image soignée et réaliste, mouvement de caméra doux et continu, lumière naturelle.",
    brand.brandColors.length > 0 ? `Ambiance colorée en accord avec : ${brand.brandColors.slice(0, 4).join(", ")}.` : "",
    "Impératif : aucun texte à l'écran, aucune lettre, aucun chiffre, aucun logo, aucune marque existante.",
    "Pas de personne réelle connue ; si des personnes apparaissent, elles sont anonymes et naturelles.",
  ]
    .filter(Boolean)
    .join("\n");
}
