import "server-only";
import sharp from "sharp";
import type { MediaAssetDoc } from "@/server/db/collections";

const FORMAT_TO_MIME: Record<string, MediaAssetDoc["mimeType"]> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Analyse le contenu réel d'un fichier (pas son extension ni le type annoncé).
 * Retourne null si ce n'est pas une image acceptée.
 */
export async function inspectImage(
  bytes: Buffer,
): Promise<{ mimeType: MediaAssetDoc["mimeType"]; width: number; height: number } | null> {
  try {
    const meta = await sharp(bytes).metadata();
    const mimeType = meta.format ? FORMAT_TO_MIME[meta.format] : undefined;
    if (!mimeType || !meta.width || !meta.height) return null;
    // Les dimensions tiennent compte de la rotation EXIF (photos de téléphone).
    const rotated = (meta.orientation ?? 1) >= 5;
    return { mimeType, width: rotated ? meta.height : meta.width, height: rotated ? meta.width : meta.height };
  } catch {
    return null;
  }
}

/** Prépare une image pour l'incrustation dans un gabarit : rotation EXIF appliquée, taille réduite, JPEG ou PNG. */
export async function toEmbeddableDataUrl(bytes: Buffer, maxSize: number, keepTransparency: boolean): Promise<string> {
  const image = sharp(bytes).rotate().resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true });
  const output = keepTransparency ? await image.png().toBuffer() : await image.jpeg({ quality: 88 }).toBuffer();
  return `data:image/${keepTransparency ? "png" : "jpeg"};base64,${output.toString("base64")}`;
}

/** Convertit en JPEG : format le plus largement accepté par les API des réseaux sociaux. */
export async function toJpeg(png: Buffer): Promise<Buffer> {
  return sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
