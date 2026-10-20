import type { NextConfig } from "next";

/**
 * Politique de sécurité du contenu. Les scripts en ligne restent autorisés (Next.js en injecte pour l'hydratation ;
 * un nonce imposerait un rendu dynamique de toutes les pages). Tout le reste est limité au site lui-même, plus
 * l'envoi direct des fichiers vers Vercel Blob. La barre d'outils Vercel n'est autorisée que sur les prévisualisations.
 */
const preview = process.env.VERCEL_ENV === "preview";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${preview ? " https://vercel.live" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // ipc: et ipc.localhost : passerelle de l'application de bureau (IA locale), inerte dans un navigateur.
  `connect-src 'self' https://vercel.com https://*.vercel-storage.com ipc: http://ipc.localhost${preview ? " https://vercel.live wss://*.pusher.com" : ""}`,
  `frame-src ${preview ? "https://vercel.live" : "'none'"}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // En développement, Next.js a besoin de libertés (rechargement à chaud) : la politique ne s'applique qu'en production.
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] : []),
];

const nextConfig: NextConfig = {
  transpilePackages: ["@smia/shared"],
  poweredByHeader: false,
  // Polices des visuels, lues à l'exécution : à inclure dans le déploiement.
  outputFileTracingIncludes: { "/**": ["./assets/fonts/**"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
