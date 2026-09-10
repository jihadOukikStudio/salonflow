import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SalonFlow",
    short_name: "SalonFlow",
    description: "Planning et organisation du salon Le 7ème Sens Marrakech",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fcf9f6",
    theme_color: "#3b2f2a",
    lang: "fr",
    categories: ["business", "productivity", "lifestyle"],
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
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
