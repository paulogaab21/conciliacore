import type { MetadataRoute } from "next";
import { defaultLocale, dictionaries } from "@/i18n/messages";

export default function manifest(): MetadataRoute.Manifest {
  const messages = dictionaries[defaultLocale];

  return {
    id: "/",
    name: messages["manifest.name"],
    short_name: "ConciliaCore",
    description: messages["manifest.description"],
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#102d29",
    theme_color: "#102d29",
    categories: ["finance", "business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
