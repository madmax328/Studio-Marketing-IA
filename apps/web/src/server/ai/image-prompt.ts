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
