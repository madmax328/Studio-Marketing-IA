import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/site-url";

const PAGES = ["", "/fonctionnalites", "/tarifs", "/inscription", "/connexion", "/mentions-legales", "/conditions", "/confidentialite", "/suppression-des-donnees"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicSiteUrl();
  return PAGES.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/tarifs" || path === "/fonctionnalites" ? 0.8 : 0.4,
  }));
}
