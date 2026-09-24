import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O E2E compila em pasta própria para não disputar a .next com o `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
