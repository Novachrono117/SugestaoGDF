import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    // Valores fixos só para testes; nunca lidos do .env real.
    env: {
      APP_URL: "http://voz.test",
      GDF_WEBHOOK_URL: "http://gdf.test/manifestacoes",
      GDF_WEBHOOK_KEY: "chave-push-de-teste-0123456789abcdef",
      GDF_CALLBACK_KEY: "chave-callback-de-teste-0123456789abcdef",
      OLLAMA_MODEL: "",
    },
  },
});
