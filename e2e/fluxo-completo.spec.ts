// Fluxo principal da Fase 1 (docs/ROADMAP.md item 10), no navegador, com viewport de celular:
// cidadã denuncia → chega no Simulador GDF → "GDF" encaminha e resolve → público vê "Resolvida"
// → a cidadã confirma a solução. Banco e build isolados (scripts/e2e-servidor.mjs).
import { existsSync } from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

// Com `npm run ras:baixar`, o seed do E2E grava os limites oficiais e a RA é detectada pelo ponto.
const TEM_LIMITES = existsSync("data/cache/ras-oficiais.geojson");

const SENHA = process.env.E2E_SENHA || "senha-e2e-ficticia"; // usuários fictícios do seed do e2e.db
const CIDADA = "cidada@vozdf.example";
const OPERADOR = "operador@vozdf.example";

// Contextos criados à mão precisam ser fechados: senão as páginas de um teste continuam vivas nos seguintes.
const contextos: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contextos.splice(0).map((c) => c.close()));
});

async function novaPagina(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext();
  contextos.push(contexto);
  return contexto.newPage();
}

async function entrar(browser: Browser, email: string): Promise<Page> {
  const page = await novaPagina(browser);
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("link", { name: /^Minha conta/ })).toBeVisible();
  return page;
}

/** Nenhuma tela pode rolar na horizontal no celular (regressão real: select largo no simulador). */
async function semRolagemHorizontal(page: Page) {
  const { rolagem, janela } = await page.evaluate(() => ({
    rolagem: document.documentElement.scrollWidth,
    janela: window.innerWidth,
  }));
  expect(rolagem, `página mais larga que a tela em ${page.url()}`).toBeLessThanOrEqual(janela);
}

const MAILPIT = process.env.MAILPIT_URL || "http://localhost:8025";

/** Assuntos dos e-mails recebidos pelo Mailpit para um destinatário, criados depois de `desde`. */
async function assuntosRecebidos(para: string, desde: Date): Promise<string[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${para}`)}&limit=50`);
  if (!res.ok) return [];
  const { messages } = (await res.json()) as { messages: { Subject: string; Created: string }[] };
  return messages.filter((m) => new Date(m.Created) >= desde).map((m) => m.Subject);
}

async function decidir(page: Page, status: string, extras: { texto?: string } = {}) {
  await page.getByLabel("Novo status").selectOption({ label: status });
  if (extras.texto) await page.getByLabel(/Justificativa|Mensagem ao cidadão/).fill(extras.texto);
  await page.getByRole("button", { name: "Registrar decisão" }).click();
  // Texto específico da decisão: a mensagem da decisão anterior continua na tela.
  await expect(page.getByText(`Status atualizado para ${status}.`)).toBeVisible();
}

test("denúncia percorre cidadão → GDF → cidadão e termina confirmada", async ({ browser }) => {
  const inicio = new Date(Date.now() - 1000);
  // ---------- cidadã registra a denúncia pelo assistente
  const cidada = await entrar(browser, CIDADA);
  await cidada.goto("/denunciar");
  await cidada.getByLabel("O que está acontecendo?").fill(
    "O poste da minha rua está apagado há uma semana e a rua fica escura à noite.",
  );
  await semRolagemHorizontal(cidada);
  await cidada.getByRole("button", { name: "Continuar" }).click();

  // IA (regras no E2E) sugere a categoria; a cidadã confirma.
  await expect(cidada.getByText("Parece ser: Iluminação pública")).toBeVisible();
  await expect(cidada.getByText("A IA só sugere. Quem decide o órgão responsável é o GDF.")).toBeVisible();
  await cidada.getByRole("button", { name: "Sim, é isso" }).click();

  // Local: toque no mapa (centro do DF) + RA.
  const mapa = cidada.locator(".leaflet-container");
  await expect(mapa.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
  const caixa = (await mapa.boundingBox())!;
  await mapa.click({ position: { x: caixa.width / 2, y: caixa.height / 2 } });
  await expect(cidada.getByText(/^Local marcado:/)).toBeVisible();
  await semRolagemHorizontal(cidada);
  if (TEM_LIMITES) {
    // O centro do mapa (Eixo Monumental) fica no Plano Piloto.
    await expect(cidada.getByText("Identificamos Plano Piloto pelo local marcado.", { exact: false })).toBeVisible();
    await expect(cidada.getByLabel("Região Administrativa")).toHaveValue("RA-I");
  } else {
    await cidada.getByLabel("Região Administrativa").selectOption({ label: "Plano Piloto" });
  }
  await cidada.getByRole("button", { name: "Revisar" }).click();

  await expect(cidada.getByText("Órgão provável (o GDF decide)")).toBeVisible();
  await cidada.getByRole("button", { name: "Enviar denúncia" }).click();

  await expect(cidada.getByText("Denúncia registrada!")).toBeVisible();
  await expect(cidada.getByText("Ela já foi enviada ao GDF.")).toBeVisible();
  const protocolo = cidada.url().match(/DF-\d{4}-\d{6}/)![0];

  // ---------- operador do GDF decide no simulador
  const operador = await entrar(browser, OPERADOR);
  await operador.goto("/simulador-gdf");
  await operador.getByRole("link", { name: new RegExp(protocolo) }).click();
  await expect(operador.getByRole("heading", { name: protocolo })).toBeVisible();
  await expect(operador.getByText("Sugestão da IA")).toBeVisible();
  await operador.getByLabel("Novo status").selectOption({ label: "Encaminhada ao órgão" }); // mostra o select de órgão (o mais largo)
  await semRolagemHorizontal(operador);
  // Payload não carrega dados pessoais da cidadã.
  await operador.getByText("JSON recebido pela API").click();
  await expect(operador.locator("pre")).not.toContainText(CIDADA);
  await semRolagemHorizontal(operador);

  await operador.getByRole("button", { name: "Registrar avaliação da IA" }).click(); // "Sim" é o padrão
  await expect(operador.getByText("Avaliação da IA registrada no Voz DF.")).toBeVisible();

  await decidir(operador, "Em análise pelo GDF");
  await decidir(operador, "Encaminhada ao órgão"); // órgão pré-preenchido com a sugestão (CEB-IPES)
  await decidir(operador, "Em execução");
  await decidir(operador, "Resolvida", { texto: "Lâmpada substituída." });

  // ---------- a cidadã recebeu um e-mail por mudança de status (Mailpit do docker compose)
  await expect
    .poll(() => assuntosRecebidos(CIDADA, inicio), { timeout: 15_000 })
    .toEqual(
      expect.arrayContaining([
        `[Voz DF] ${protocolo}: Em análise pelo GDF`,
        `[Voz DF] ${protocolo}: Encaminhada ao órgão`,
        `[Voz DF] ${protocolo}: Em execução`,
        `[Voz DF] ${protocolo}: Resolvida`,
      ]),
    );

  // ---------- público (sem login) acompanha pelo protocolo: vê andamento, não vê o relato
  const publico = await novaPagina(browser);
  await publico.goto("/acompanhar");
  await publico.getByLabel("Número do protocolo").fill(protocolo.toLowerCase());
  await publico.getByRole("button", { name: "Acompanhar" }).click();
  await expect(publico).toHaveURL(new RegExp(`/acompanhar/${protocolo}$`));
  await expect(publico.getByText("Resolvida").first()).toBeVisible();
  await expect(publico.getByText("(CEB-IPES)").first()).toBeVisible();
  await expect(publico.getByText("Lâmpada substituída.")).toBeVisible();
  await expect(publico.getByText("O poste da minha rua")).toHaveCount(0);
  await semRolagemHorizontal(publico);

  await publico.goto("/mapa");
  await expect(publico.getByText(/denúncia\(s\) no mapa/)).toBeVisible();
  await semRolagemHorizontal(publico);

  await publico.goto("/transparencia");
  await expect(publico.getByRole("heading", { name: "Por Região Administrativa" })).toBeVisible();
  await expect(publico.getByRole("rowheader", { name: "Plano Piloto" })).toBeVisible();
  await semRolagemHorizontal(publico);

  // CSV do simulador: só operador; sem o relato.
  expect((await publico.request.get("/api/simulador-gdf/relatorio")).status()).toBe(401);
  const csv = await operador.request.get("/api/simulador-gdf/relatorio");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const conteudo = await csv.text();
  expect(conteudo).toContain(protocolo);
  expect(conteudo).not.toContain("O poste da minha rua");

  // ---------- a cidadã confirma que foi resolvido
  await cidada.goto(`/acompanhar/${protocolo}`);
  await expect(cidada.getByText("O GDF informou que o problema foi resolvido. Foi mesmo?")).toBeVisible();
  await cidada.getByRole("button", { name: "Sim, foi resolvido" }).click();
  await expect(cidada.getByText("Você confirmou que o problema foi resolvido.")).toBeVisible();

  // ---------- e o simulador registra a confirmação
  await operador.reload();
  await expect(operador.getByText("O cidadão confirmou que o problema foi resolvido.")).toBeVisible();
});

test("contestação exige justificativa e reabre a denúncia no GDF", async ({ browser }) => {
  const cidada = await entrar(browser, CIDADA);
  const operador = await entrar(browser, OPERADOR);

  // Denúncia via API (o assistente já foi coberto acima), autenticada como a cidadã.
  const resposta = await cidada.request.post("/api/v1/denuncias", {
    data: {
      descricao: "Buraco enorme no asfalto na frente do mercado da quadra 3.",
      categoriaSlug: "buracos-vias",
      raCodigo: "RA-III",
      latitude: -15.83,
      longitude: -48.05,
    },
  });
  expect(resposta.status()).toBe(201);
  const { protocolo } = await resposta.json();

  await operador.goto(`/simulador-gdf/${protocolo}`);
  await decidir(operador, "Encaminhada ao órgão");
  await decidir(operador, "Em execução");
  await decidir(operador, "Resolvida", { texto: "Buraco tapado." });

  await cidada.goto(`/acompanhar/${protocolo}`);
  await cidada.getByRole("button", { name: "Não, o problema continua" }).click();
  const justificativa = cidada.getByLabel("Conte o que ainda não foi resolvido (obrigatório)");
  await expect(justificativa).toHaveAttribute("required", "");
  await justificativa.fill("Taparam só metade, o buraco continua do outro lado da pista.");
  await cidada.getByRole("button", { name: "Reabrir denúncia" }).click();
  await expect(cidada.getByText("Reaberta pelo cidadão").first()).toBeVisible();

  await operador.reload();
  await expect(operador.getByText("O cidadão reabriu esta denúncia:")).toBeVisible();
  await expect(operador.getByText("Taparam só metade")).toBeVisible();
  await expect(operador.getByLabel("Novo status")).toContainText("Em análise pelo GDF");
});

test("pessoa nova se cadastra e apoia uma denúncia próxima em vez de duplicar", async ({ browser }) => {
  // Denúncia já existente no centro do mapa (onde o assistente abre), em andamento.
  const cidada = await entrar(browser, CIDADA);
  const resposta = await cidada.request.post("/api/v1/denuncias", {
    data: {
      descricao: "Poste apagado no Eixo Monumental, perto da Torre de TV.",
      categoriaSlug: "iluminacao-publica",
      raCodigo: "RA-I",
      latitude: -15.7939,
      longitude: -47.8828,
    },
  });
  expect(resposta.status()).toBe(201);
  const { protocolo } = await resposta.json();

  // Cadastro pela tela.
  const vizinho = await novaPagina(browser);
  await vizinho.goto("/cadastro");
  await vizinho.getByLabel("Nome").fill("Vizinho E2E (fictício)");
  await vizinho.getByLabel("E-mail").fill(`vizinho-${Date.now()}@vozdf.example`);
  await vizinho.getByLabel("Senha").fill("senha-do-vizinho-123");
  await vizinho.getByRole("button", { name: "Criar conta" }).click();
  await expect(vizinho.getByRole("link", { name: /^Minha conta/ })).toBeVisible();

  // Começa a denunciar o mesmo problema no mesmo lugar → o assistente oferece apoiar.
  await vizinho.goto("/denunciar");
  await vizinho.getByLabel("O que está acontecendo?").fill("O poste da esquina está apagado há dias e a rua fica escura.");
  await vizinho.getByRole("button", { name: "Continuar" }).click();
  await vizinho.getByRole("button", { name: "Sim, é isso" }).click();
  const mapa = vizinho.locator(".leaflet-container");
  await expect(mapa.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });
  const caixa = (await mapa.boundingBox())!;
  await mapa.click({ position: { x: caixa.width / 2, y: caixa.height / 2 } });

  await expect(vizinho.getByRole("heading", { name: "Pode ser o mesmo problema?" })).toBeVisible();
  await semRolagemHorizontal(vizinho);
  await vizinho
    .getByRole("listitem")
    .filter({ hasText: protocolo })
    .getByRole("button", { name: "Apoiar esta denúncia" })
    .click();

  await expect(vizinho).toHaveURL(`/acompanhar/${protocolo}?apoio=1`);
  await expect(vizinho.getByText("Apoio registrado!")).toBeVisible();
  await expect(vizinho.getByText("1 pessoa(s) também têm esse problema — inclusive você")).toBeVisible();

  // O "GDF" recebeu o total de apoios.
  const operador = await entrar(browser, OPERADOR);
  await operador.goto(`/simulador-gdf/${protocolo}`);
  await expect(operador.getByText("👍 1 pessoa(s) relataram o mesmo problema")).toBeVisible();
});
