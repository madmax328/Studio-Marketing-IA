import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { IMAGE_FORMAT_IDS, IMAGE_FORMATS, TEMPLATE_IDS } from "@smia/shared";
import { toEmbeddableDataUrl, toJpeg } from "@/server/media/images";
import { renderTemplatePng } from "@/server/media/templates";

async function samplePhoto(): Promise<Buffer> {
  return sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#2a9d8f" } }).jpeg().toBuffer();
}

describe("gabarits de visuels", () => {
  it.each(TEMPLATE_IDS)("le gabarit %s produit une image aux bonnes dimensions dans chaque format", async (templateId) => {
    const background = await toEmbeddableDataUrl(await samplePhoto(), 2160, false);
    for (const format of IMAGE_FORMAT_IDS) {
      const png = await renderTemplatePng({
        templateId,
        format,
        title: "Nouveau menu d'automne : soupe de potiron, châtaignes et crème brûlée",
        subtitle: "Dès le 15 octobre, midi et soir",
        brandName: "Café du Port",
        color: "#4f46e5",
        secondaryColor: "#f5f5f4",
        backgroundDataUrl: background,
        logoDataUrl: null,
      });
      const jpeg = await toJpeg(png);
      const meta = await sharp(jpeg).metadata();
      expect(meta.format).toBe("jpeg");
      expect(meta.width).toBe(IMAGE_FORMATS[format].width);
      expect(meta.height).toBe(IMAGE_FORMATS[format].height);
    }
  });
});
