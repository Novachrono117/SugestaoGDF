// Acessibilidade (Fase 2, etapa 7): axe-core com as regras WCAG 2.1 A/AA em cada tela,
// no viewport de celular. Cobre também os passos do assistente e a página offline.
// axe acha ~30–50% dos problemas; teclado e leitor de tela seguem conferidos à mão (docs/ACESSIBILIDADE.md).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const SENHA = process.env.E2E_SENHA || "senha-e2e-ficticia";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function auditar(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const resumo = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 5).map((n) => n.target.join(" ")).join("\n    ")}`,
  );
  expect(resumo, `violações em ${page.url()}`).toEqual([]);
}

const contextos: BrowserContext[] = [];
test.afterAll(async () => {
  await Promise.all(contextos.splice(0).map((c) => c.close()));
});

async function entrar(browser: Browser, email: string): Promise<Page> {
  const contexto = await browser.newContext();
  contextos.push(contexto);
  const page = await contexto.newPage();
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("link", { name: /^Minha conta/ })).toBeVisible();
  return page;
}

test.describe.configure({ mode: "serial" });

let protocolo = "";
let cidada: Page;
let operador: Page;

test.beforeAll(async ({ browser }) => {
  cidada = await entrar(browser, "cidada@vozdf.example");
  operador = await entrar(browser, "operador@vozdf.example");
  const res = await cidada.request.post("/api/v1/denuncias", {
    multipart: {
      descricao: "Calçada quebrada em frente à parada de ônibus, difícil passar com cadeira de rodas.",
      categoriaSlug: "acessibilidade",
      raCodigo: "RA-III",
      latitude: "-15.8335",
      longitude: "-48.0565",
      anonima: "false",
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  protocolo = (await res.json()).protocolo;
});

for (const rota of ["/", "/entrar", "/cadastro", "/acompanhar", "/mapa", "/transparencia", "/privacidade", "/offline.html"]) {
  test(`público ${rota}`, async ({ page }) => {
    await page.goto(rota);
    if (rota === "/mapa") await expect(page.locator(".leaflet-container")).toBeVisible();
    await auditar(page);
  });
}

test("público: consulta por protocolo", async ({ page }) => {
  await page.goto(`/acompanhar/${protocolo}`);
  await expect(page.getByText(protocolo).first()).toBeVisible();
  await auditar(page);
});

test("formulário de login com erro", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("ninguem@vozdf.example");
  await page.getByLabel("Senha").fill("senha-errada-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /./ })).toBeVisible();
  await auditar(page);
});

test("link para pular o menu leva ao conteúdo", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const pular = page.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(pular).toBeFocused();
  // Aparece ao receber foco. toBeVisible() não basta: passa mesmo fora da tela.
  const caixa = (await pular.boundingBox())!;
  expect(caixa.y).toBeGreaterThanOrEqual(0);
  expect(caixa.height).toBeGreaterThanOrEqual(40);
  await page.keyboard.press("Enter");
  await expect(page.locator("#conteudo")).toBeFocused();
});

test("assistente: os quatro passos, só com teclado", async () => {
  const page = cidada;
  await page.goto("/denunciar");
  await auditar(page);
  await page.getByLabel("O que está acontecendo?").fill("O poste da minha rua está apagado há uma semana e a rua fica escura.");
  await page.getByRole("button", { name: "Continuar" }).press("Enter");
  await expect(page.getByText("Parece ser:", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Passo 2 de 4: Categoria" })).toBeFocused();
  await auditar(page);
  await page.getByRole("button", { name: "Sim, é isso" }).press("Enter");

  // Local sem mouse/toque: foco no mapa, setas para mover, botão marca o centro.
  const mapa = page.locator(".leaflet-container");
  await expect(mapa.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
  await mapa.focus();
  await page.keyboard.press("ArrowUp");
  await page.getByRole("button", { name: "Marcar o centro do mapa" }).press("Enter");
  await expect(page.getByText(/^Local marcado:/)).toBeVisible();
  await page.getByLabel("Região Administrativa").selectOption({ label: "Plano Piloto" });
  await auditar(page);
  await page.getByRole("button", { name: "Revisar" }).press("Enter");
  await expect(page.getByText("Órgão provável (o GDF decide)")).toBeVisible();
  await auditar(page);
  await page.evaluate(() => localStorage.clear()); // não deixa rascunho para os próximos testes
});

test("cidadã: minhas denúncias, minha conta e detalhe do autor", async () => {
  for (const rota of ["/minhas-denuncias", "/minha-conta", `/acompanhar/${protocolo}`]) {
    await cidada.goto(rota);
    await auditar(cidada);
  }
});

test("reflow: nada rola na horizontal a 320 px de largura (equivale a zoom de 400%)", async () => {
  for (const [page, rota] of [
    [cidada, "/"],
    [cidada, "/denunciar"],
    [cidada, `/acompanhar/${protocolo}`],
    [cidada, "/minhas-denuncias"],
    [cidada, "/transparencia"],
    [cidada, "/mapa"],
    [operador, `/simulador-gdf/${protocolo}`],
  ] as const) {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(rota);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura, `rolagem horizontal em ${rota}`).toBeLessThanOrEqual(320);
  }
});

test("operador: simulador (lista e decisão)", async () => {
  await operador.goto("/simulador-gdf");
  await auditar(operador);
  await operador.goto(`/simulador-gdf/${protocolo}`);
  await operador.getByLabel("Novo status").selectOption({ label: "Encaminhada ao órgão" });
  await auditar(operador);
});
