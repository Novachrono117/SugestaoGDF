import type { MetadataRoute } from "next";

// Torna o site instalável ("Adicionar à tela inicial"). Requer HTTPS em produção; localhost vale como seguro.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Voz DF — denúncias do Distrito Federal",
    short_name: "Voz DF",
    description: "Denuncie problemas da sua região; o GDF decide o órgão e você acompanha pelo protocolo.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1d4ed8",
    categories: ["government", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Fazer denúncia", url: "/denunciar" },
      { name: "Acompanhar protocolo", url: "/acompanhar" },
    ],
  };
}
