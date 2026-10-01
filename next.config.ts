import type { NextConfig } from "next";

// Cabeçalhos de segurança em todas as respostas. A Content-Security-Policy fica em src/proxy.ts: precisa
// de um nonce novo por requisição, o que um cabeçalho fixo daqui não consegue.
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
  // NEXT_BUILD_CPUS limita os processos do build (padrão: um por núcleo). Com pouca memória livre,
  // 23 processos em paralelo estouraram a memória do notebook ("heap out of memory").
  ...(Number(process.env.NEXT_BUILD_CPUS) > 0 && { experimental: { cpus: Number(process.env.NEXT_BUILD_CPUS) } }),
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
