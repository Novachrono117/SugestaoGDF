import type { NextConfig } from "next";

// Cabeçalhos de segurança em todas as respostas. CSP fica de fora por ora: o Next injeta scripts
// inline e exigiria nonce por requisição (docs/DEPLOY.md, "Pendências").
const cabecalhosDeSeguranca = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // GPS no passo "Local"; câmera via <input capture> não depende desta política.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=()" },
];

const nextConfig: NextConfig = {
  // O E2E compila em pasta própria para não disputar a .next com o `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Build enxuto para a imagem Docker (.next/standalone + server.js). Ver Dockerfile.
  output: "standalone",
  async headers() {
    return [
      { source: "/:path*", headers: cabecalhosDeSeguranca },
      {
        // Sem cache HTTP no service worker: uma versão nova chega na próxima visita.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
