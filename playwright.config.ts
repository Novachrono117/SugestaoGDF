import { defineConfig, devices } from "@playwright/test";

const PORTA = Number(process.env.E2E_PORTA || 3100);

export default defineConfig({
  testDir: "e2e",
  // O fluxo compartilha um banco: roda em série.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORTA}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "celular",
      use: {
        ...devices["Pixel 7"],
        // Usa o navegador já instalado (Edge por padrão no Windows). Em CI: PLAYWRIGHT_CHANNEL="" + `npx playwright install chromium`.
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
      },
    },
  ],
  webServer: {
    command: "node scripts/e2e-servidor.mjs",
    url: `http://localhost:${PORTA}/api/v1/regioes`,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
