import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { CSSProperties, ReactElement } from "react";
import { IMAGE_FORMATS, readableTextColor, type ImageFormatId, type TemplateId } from "@smia/shared";

export interface TemplateData {
  templateId: TemplateId;
  format: ImageFormatId;
  title: string;
  subtitle: string;
  brandName: string;
  color: string;
  secondaryColor: string;
  /** Image de fond (data URL), obligatoire pour les gabarits photo. */
  backgroundDataUrl: string | null;
  logoDataUrl: string | null;
}

let fontsPromise: Promise<{ name: string; data: ArrayBuffer; weight: 500 | 800; style: "normal" }[]> | undefined;

function loadFonts() {
  fontsPromise ??= Promise.all(
    ([500, 800] as const).map(async (weight) => {
      const file = await readFile(join(process.cwd(), `assets/fonts/montserrat-latin-${weight}-normal.woff`));
      const data = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
      return { name: "Montserrat", data, weight, style: "normal" as const };
    }),
  );
  return fontsPromise;
}

/** Taille de titre adaptée à la longueur du texte et au format. */
function titleSize(title: string, width: number, base: number): number {
  const scale = width / 1080;
  const length = title.length;
  const size = length <= 20 ? base : length <= 45 ? base * 0.75 : length <= 80 ? base * 0.58 : base * 0.46;
  return Math.round(size * scale);
}

function Logo({ src, size }: { src: string | null; size: number }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={{ height: size, maxWidth: size * 3, objectFit: "contain" }} />;
}

function layout(data: TemplateData, width: number, height: number): ReactElement {
  const pad = Math.round(width * 0.07);
  const onColor = readableTextColor(data.color);
  const logoSize = Math.round(Math.min(width, height) * 0.12);
  const fill: CSSProperties = { width: "100%", height: "100%", display: "flex", fontFamily: "Montserrat" };

  switch (data.templateId) {
    case "photo_bandeau":
      return (
        <div style={{ ...fill, position: "relative" }}>
          {data.backgroundDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.backgroundDataUrl} alt="" style={{ position: "absolute", inset: 0, width, height, objectFit: "cover" }} />
          ) : null}
          {data.logoDataUrl ? (
            <div style={{ position: "absolute", top: pad, left: pad, display: "flex", background: "rgba(255,255,255,0.9)", padding: logoSize * 0.18, borderRadius: logoSize * 0.2 }}>
              <Logo src={data.logoDataUrl} size={logoSize * 0.8} />
            </div>
          ) : null}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", background: data.color, color: onColor, padding: pad }}>
            <div style={{ fontSize: titleSize(data.title, width, 84), fontWeight: 800, lineHeight: 1.1 }}>{data.title}</div>
            {data.subtitle ? <div style={{ fontSize: Math.round(width * 0.033), fontWeight: 500, marginTop: pad * 0.3 }}>{data.subtitle}</div> : null}
          </div>
        </div>
      );

    case "couleur_titre":
      return (
        <div style={{ ...fill, flexDirection: "column", justifyContent: "space-between", background: data.color, color: onColor, padding: pad }}>
          <Logo src={data.logoDataUrl} size={logoSize} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: titleSize(data.title, width, 110), fontWeight: 800, lineHeight: 1.05 }}>{data.title}</div>
            {data.subtitle ? <div style={{ fontSize: Math.round(width * 0.036), fontWeight: 500, marginTop: pad * 0.4, opacity: 0.9 }}>{data.subtitle}</div> : null}
          </div>
          <div style={{ fontSize: Math.round(width * 0.026), fontWeight: 500, opacity: 0.8 }}>{data.brandName}</div>
        </div>
      );

    case "promo":
      return (
        <div style={{ ...fill, flexDirection: "column", alignItems: "center", justifyContent: "center", background: data.secondaryColor, padding: pad }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", background: data.color, color: onColor, padding: pad, borderRadius: pad * 0.5, width: "100%" }}>
            <div style={{ fontSize: titleSize(data.title, width, 120), fontWeight: 800, lineHeight: 1.05 }}>{data.title}</div>
            {data.subtitle ? <div style={{ fontSize: Math.round(width * 0.038), fontWeight: 500, marginTop: pad * 0.4 }}>{data.subtitle}</div> : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: pad * 0.3, marginTop: pad * 0.6, color: readableTextColor(data.secondaryColor) }}>
            <Logo src={data.logoDataUrl} size={logoSize * 0.8} />
            <div style={{ fontSize: Math.round(width * 0.03), fontWeight: 800 }}>{data.brandName}</div>
          </div>
        </div>
      );

    case "citation":
      return (
        <div style={{ ...fill, flexDirection: "column", justifyContent: "center", background: "#ffffff", color: "#111111", padding: pad, borderLeft: `${Math.round(width * 0.03)}px solid ${data.color}` }}>
          <div style={{ fontSize: Math.round(width * 0.15), fontWeight: 800, color: data.color, lineHeight: 0.8 }}>“</div>
          <div style={{ fontSize: titleSize(data.title, width, 92), fontWeight: 800, lineHeight: 1.2 }}>{data.title}</div>
          {data.subtitle ? <div style={{ fontSize: Math.round(width * 0.032), fontWeight: 500, marginTop: pad * 0.4, color: "#444444" }}>{data.subtitle}</div> : null}
          <div style={{ display: "flex", alignItems: "center", gap: pad * 0.3, marginTop: pad }}>
            <Logo src={data.logoDataUrl} size={logoSize * 0.7} />
            <div style={{ fontSize: Math.round(width * 0.028), fontWeight: 800, color: data.color }}>{data.brandName}</div>
          </div>
        </div>
      );
  }
}

/** Produit l'image PNG d'un gabarit. */
export async function renderTemplatePng(data: TemplateData): Promise<Buffer> {
  const { width, height } = IMAGE_FORMATS[data.format];
  const response = new ImageResponse(layout(data, width, height), { width, height, fonts: await loadFonts() });
  return Buffer.from(await response.arrayBuffer());
}
