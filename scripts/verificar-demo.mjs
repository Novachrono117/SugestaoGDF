// Ensaio automático do caminho da turma, por um endereço que NÃO é localhost (túnel ou rede local):
// cadastro de colega fictício → denúncia com a IA → operador vê no simulador. Cria dados no banco vozdf_demo.
//   npm run demo:verificar -- https://xxxx.trycloudflare.com
import "dotenv/config";
import { chromium, devices } from "@playwright/test";

const BASE = process.argv[2];
if (!BASE) {
  console.error("Uso: npm run demo:verificar -- <endereço do túnel ou da rede local>");
  process.exit(1);
}
const browser = await chromium.launch({ channel: "msedge" });
const passos = [];
const ok = (t) => passos.push(`ok  ${t}`);
try {
  // Colega: celular, conta nova com e-mail inventado.
  const cel = await browser.newContext({ ...devices["Pixel 7"], baseURL: BASE });
  const p = await cel.newPage();
  const violacoes = [];
  p.on("console", (m) => m.type() === "error" && /Content Security Policy|Refused/.test(m.text()) && violacoes.push(m.text()));
  await p.goto("/cadastro");
  await p.getByLabel("Nome").fill("Colega Teste (fictício)");
  await p.getByLabel("E-mail").fill(`colega-${Date.now()}@teste.example`);
  await p.getByLabel("Senha").fill("senha-do-colega-1");
  await p.getByLabel(/Li o aviso de privacidade/).check();
  await p.getByRole("button", { name: "Criar conta" }).click();
  await p.getByRole("link", { name: /^Minha conta/ }).waitFor({ timeout: 15000 });
  ok("cadastro + login pelo endereço da rede");

  await p.goto("/denunciar");
  await p.getByLabel("O que está acontecendo?").fill("Tem um bueiro entupido na minha rua e quando chove alaga tudo.");
  const t0 = Date.now();
  await p.getByRole("button", { name: "Continuar" }).click();
  await p.getByText("Parece ser:", { exact: false }).waitFor({ timeout: 30000 });
  const sugestao = await p.getByText("Parece ser:", { exact: false }).first().innerText();
  ok(`IA respondeu em ${((Date.now() - t0) / 1000).toFixed(1)} s → ${sugestao.trim()}`);
  await p.getByRole("button", { name: /Sim, é isso|Continuar com a minha escolha/ }).click();
  const mapa = p.locator(".leaflet-container");
  await mapa.locator(".leaflet-tile-loaded").first().waitFor({ timeout: 20000 });
  const caixa = await mapa.boundingBox();
  await mapa.click({ position: { x: caixa.width / 2, y: caixa.height / 2 } });
  await p.getByText(/^Local marcado:/).waitFor();
  const ra = p.getByLabel("Região Administrativa");
  if (!(await ra.inputValue())) await ra.selectOption({ label: "Plano Piloto" });
  await p.getByRole("button", { name: "Revisar" }).click();
  await p.getByRole("button", { name: "Enviar denúncia" }).click();
  await p.getByText("Denúncia registrada!").waitFor({ timeout: 15000 });
  const protocolo = p.url().match(/DF-\d{4}-\d{6}/)[0];
  ok(`denúncia enviada pelo celular: ${protocolo}`);
  const largura = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  if (!largura) passos.push("FALHA rolagem horizontal no celular");
  if (violacoes.length) passos.push(`FALHA CSP: ${violacoes.join(" | ")}`);
  else ok("nenhuma violação de CSP");

  // Apresentador: operador vê a denúncia chegar no simulador.
  const op = await browser.newContext({ baseURL: BASE });
  const o = await op.newPage();
  await o.goto("/entrar");
  await o.getByLabel("E-mail").fill("operador@vozdf.example");
  await o.getByLabel("Senha").fill(process.env.SEED_SENHA_DEMO);
  await o.getByRole("button", { name: "Entrar" }).click();
  await o.getByRole("link", { name: /^Minha conta/ }).waitFor({ timeout: 15000 });
  await o.goto("/simulador-gdf");
  await o.getByRole("link", { name: new RegExp(protocolo) }).waitFor();
  const total = await o.getByRole("link", { name: /DF-\d{4}-\d{6}/ }).count();
  ok(`operador vê ${protocolo} no simulador (${total} manifestações na lista)`);
} catch (e) {
  passos.push(`FALHA ${e.message.split("\n")[0]}`);
} finally {
  await browser.close();
  console.log(passos.join("\n"));
  if (passos.some((p) => p.startsWith("FALHA"))) process.exitCode = 1;
}
