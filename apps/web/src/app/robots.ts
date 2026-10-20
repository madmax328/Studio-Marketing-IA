import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/site-url";

/** Seul le site public est référencé ; l'application et les API ne le sont pas. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/tableau-de-bord", "/studio", "/campagnes", "/calendrier", "/publications", "/medias", "/ma-marque", "/reseaux", "/abonnement", "/parametres", "/statistiques", "/notifications"],
    },
    sitemap: `${publicSiteUrl()}/sitemap.xml`,
  };
}
