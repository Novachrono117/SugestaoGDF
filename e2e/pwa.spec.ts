// PWA (Fase 2, etapa 6): instalável, rascunho da denúncia no aparelho e página offline.
import { expect, test } from "@playwright/test";

const RELATO = "O poste da minha rua está apagado há uma semana e a rua fica escura à noite.";

test("é instalável: manifest com ícones válidos", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();

  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ short_name: "Voz DF", display: "standalone", start_url: "/", lang: "pt-BR" });
  expect(manifest.icons.map((i: { purpose: string }) => i.purpose)).toEqual(expect.arrayContaining(["any", "maskable"]));
  for (const icone of manifest.icons) {
    const res = await request.get(icone.src);
    expect(res.status(), icone.src).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
  }
});

test("rascunho da denúncia sobrevive a recarregar a página e pode ser descartado", async ({ page }) => {
  await page.goto("/denunciar");
  await page.getByLabel("O que está acontecendo?").fill(RELATO);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Parece ser: Iluminação pública")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Continuando o rascunho salvo neste aparelho", { exact: false })).toBeVisible();
  await expect(page.getByText("Parece ser: Iluminação pública")).toBeVisible(); // voltou no mesmo passo
  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(page.getByLabel("O que está acontecendo?")).toHaveValue(RELATO);

  await page.getByRole("button", { name: "Começar do zero" }).click();
  await expect(page.getByLabel("O que está acontecendo?")).toHaveValue("");
  await page.reload();
  await expect(page.getByText("Continuando o rascunho", { exact: false })).toHaveCount(0);
});

test("sem internet: o assistente avisa e guarda; outras páginas mostram a tela offline", async ({ page, context }) => {
  await page.goto("/denunciar");
  // Espera o service worker assumir a página (ele só atua depois de ativo).
  await page.evaluate(async () => void (await navigator.serviceWorker.ready));
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  await context.setOffline(true);
  await expect(page.getByText("Você está sem internet. Pode continuar preenchendo", { exact: false })).toBeVisible();
  await page.getByLabel("O que está acontecendo?").fill(RELATO);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Sem conexão. O que você escreveu fica salvo neste aparelho", { exact: false })).toBeVisible();

  await page.goto("/transparencia");
  await expect(page.getByRole("heading", { name: "Você está sem internet" })).toBeVisible();

  await context.setOffline(false);
  await page.goto("/denunciar");
  await expect(page.getByLabel("O que está acontecendo?")).toHaveValue(RELATO);
});
