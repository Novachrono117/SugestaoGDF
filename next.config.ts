import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O E2E compila em pasta própria para não disputar a .next com o `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        // Sem cache HTTP no service worker: uma versão nova chega na próxima visita.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
