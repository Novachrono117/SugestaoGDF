// LGPD: aviso de privacidade, consentimento no cadastro e direitos do titular (baixar dados, excluir conta).
import { expect, test } from "@playwright/test";

const SENHA = "senha-da-titular-123";

test("cadastro exige aceite; titular baixa os dados e exclui a conta", async ({ page }) => {
  const email = `titular-${Date.now()}@vozdf.example`;

  // Rodapé leva ao aviso.
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Aviso de privacidade" }).click();
  await expect(page.getByRole("heading", { name: "Aviso de privacidade" })).toBeVisible();
  await expect(page.getByText("Seu nome e seu e-mail não são enviados.")).toBeVisible();

  // Sem marcar o aceite, o servidor recusa.
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Titular E2E (fictícia)");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Para criar a conta, confirme que leu o aviso de privacidade.")).toBeVisible();
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByLabel(/Li o aviso de privacidade/).check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("link", { name: /^Minha conta/ })).toBeVisible();

  // Uma denúncia para aparecer no arquivo exportado.
  const criada = await page.request.post("/api/v1/denuncias", {
    multipart: {
      descricao: "Lixo acumulado na esquina da quadra 3 há duas semanas.",
      categoriaSlug: "lixo-entulho",
      raCodigo: "RA-I",
      latitude: "-15.7939",
      longitude: "-47.8828",
      anonima: "false",
    },
  });
  expect(criada.status()).toBe(201);
  const { protocolo } = await criada.json();

  // Baixar meus dados.
  await page.goto("/minha-conta");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Baixar meus dados (JSON)" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("meus-dados-voz-df.json");
  const exportado = await (await page.request.get("/api/v1/minha-conta/dados")).json();
  expect(exportado.conta.email).toBe(email);
  expect(exportado.denuncias).toEqual([expect.objectContaining({ protocolo, relato: expect.stringContaining("Lixo acumulado") })]);
  expect(JSON.stringify(exportado)).not.toMatch(/senhaHash|\$2[aby]\$/);

  // Excluir: senha errada é recusada; com a certa, a conta some e a sessão acaba.
  await page.getByLabel("Sua senha").fill("senha-errada-000");
  await page.getByLabel("Entendo que a exclusão é definitiva.").check();
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await expect(page.getByText("Senha incorreta.")).toBeVisible();

  await page.getByLabel("Sua senha").fill(SENHA);
  await page.getByLabel("Entendo que a exclusão é definitiva.").check();
  await page.getByRole("button", { name: "Excluir minha conta" }).click();
  await expect(page.getByText("Sua conta foi excluída.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
  expect((await page.request.get("/api/v1/minha-conta/dados")).status()).toBe(401);

  // A denúncia continua (entregue ao GDF), só perdeu o vínculo.
  await page.goto(`/acompanhar/${protocolo}`);
  await expect(page.getByText(protocolo).first()).toBeVisible();

  // Não dá mais para entrar.
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
});
