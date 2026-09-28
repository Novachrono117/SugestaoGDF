// Cabeçalhos de segurança e Content-Security-Policy com nonce (src/proxy.ts).
import { expect, test, type Page } from "@playwright/test";

/** Registra toda violação de CSP da página (o navegador dispara o evento antes de bloquear). */
async function vigiarCsp(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __violacoesCsp: string[] };
    w.__violacoesCsp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      w.__violacoesCsp.push(`${e.effectiveDirective} bloqueou ${e.blockedURI || "inline"} (${e.sourceFile}:${e.lineNumber})`);
    });
  });
  return () => page.evaluate(() => (window as unknown as { __violacoesCsp: string[] }).__violacoesCsp);
}

test("CSP com nonce novo a cada requisição e cabeçalhos de segurança", async ({ request }) => {
  const [a, b] = await Promise.all([request.get("/"), request.get("/")]);
  const csp = a.headers()["content-security-policy"];
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("unsafe-eval"); // só no dev
  const nonce = (h: string) => h.match(/'nonce-([^']+)'/)![1];
  expect(nonce(csp)).not.toBe(nonce(b.headers()["content-security-policy"]));

  // Os scripts do Next saem com o nonce do cabeçalho.
  const html = await a.text();
  expect(html).toContain(`nonce="${nonce(csp)}"`);
  expect(a.headers()["x-content-type-options"]).toBe("nosniff");
  expect(a.headers()["x-frame-options"]).toBe("DENY");

  // Arquivos estáticos e API ficam fora do proxy (offline.html tem <style> inline).
  expect((await request.get("/offline.html")).headers()["content-security-policy"]).toBeUndefined();
  expect((await request.get("/api/health")).headers()["content-security-policy"]).toBeUndefined();
});

test("reenvio de pendentes: agendador com chave, anônimo e chave errada recusados", async ({ request }) => {
  const url = "/api/v1/integracao/gdf/reenviar";
  expect((await request.post(url)).status()).toBe(401); // sem sessão nem chave
  expect((await request.post(url, { headers: { Authorization: "Bearer chave-errada-0000000000000000000000000" } })).status()).toBe(401);
  const ok = await request.post(url, { headers: { Authorization: "Bearer e2e-chave-tarefas-somente-para-testes-0123456789" } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toHaveProperty("emails");
});

test("páginas funcionam sem nenhuma violação de CSP (scripts, estilos, mapa, service worker)", async ({ page }) => {
  const violacoes = await vigiarCsp(page);

  // Hidratação: o assistente só avança com o JavaScript rodando.
  await page.goto("/denunciar");
  await page.getByLabel("O que está acontecendo?").fill("O poste da minha rua está apagado há uma semana e a rua fica escura.");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Parece ser:", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Sim, é isso" }).click();
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 }); // blocos do OSM
  expect(await violacoes()).toEqual([]);

  for (const rota of ["/", "/mapa", "/transparencia", "/privacidade", "/entrar"]) {
    await page.goto(rota);
    await page.waitForLoadState("networkidle");
    expect(await violacoes(), `violações em ${rota}`).toEqual([]);
  }

  // Service worker registra apesar do 'strict-dynamic' (worker-src 'self').
  await page.evaluate(async () => void (await navigator.serviceWorker.ready));
});
