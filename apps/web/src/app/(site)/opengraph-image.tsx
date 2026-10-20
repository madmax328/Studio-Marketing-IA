import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Studio Marketing IA : vous décrivez, le studio écrit, crée et publie.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image d'aperçu des liens partagés (réseaux sociaux, messageries), aux couleurs du site. */
export default async function OpenGraphImage() {
  const font = (weight: 500 | 800) => readFile(join(process.cwd(), `assets/fonts/montserrat-latin-${weight}-normal.woff`));
  const [medium, bold] = await Promise.all([font(500), font(800)]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(70% 80% at 70% 0%, rgba(255,122,69,0.35), rgba(7,8,11,1) 70%)",
          backgroundColor: "#07080b",
          color: "#eef0f3",
          fontFamily: "Montserrat",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #ffc56b, #ff7a45 55%, #ff4f6d)" }} />
          <div style={{ fontSize: 30, fontWeight: 500 }}>Studio Marketing IA</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 78, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05 }}>Vous décrivez.</div>
          <div
            style={{
              fontSize: 78,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1.05,
              backgroundImage: "linear-gradient(90deg, #ffc56b, #ff7a45 45%, #ff4f6d)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Le studio écrit, crée et publie.
          </div>
        </div>
        <div style={{ fontSize: 26, color: "#9198a4", fontWeight: 500 }}>
          Vos réseaux sociaux, écrits et publiés pour vous · Offre gratuite
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Montserrat", data: medium, weight: 500, style: "normal" },
        { name: "Montserrat", data: bold, weight: 800, style: "normal" },
      ],
    },
  );
}
