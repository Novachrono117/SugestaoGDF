import { describe, expect, it, vi } from "vitest";
import type { PayloadGdfV1 } from "@/lib/validation/integracao-gdf";
import { chaveValida } from "../http";
import { HttpGovGateway } from "./index";

const payload = { protocolo: "DF-2026-000001" } as PayloadGdfV1;

function gateway(fetchFn: typeof fetch) {
  return new HttpGovGateway({ url: "http://gdf.test/manifestacoes", chave: "segredo", timeoutMs: 100, fetchFn });
}

describe("HttpGovGateway", () => {
  it("envia com Bearer e devolve o id externo", async () => {
    const fetchFn = vi.fn(async () => Response.json({ idExterno: "abc" })) as unknown as typeof fetch;
    expect(await gateway(fetchFn).enviar(payload)).toEqual({ ok: true, idExterno: "abc" });
    const [, init] = vi.mocked(fetchFn).mock.calls[0];
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer segredo");
    expect(JSON.parse(String(init?.body))).toEqual(payload);
  });

  it("transforma HTTP de erro em falha", async () => {
    const fetchFn = vi.fn(async () => new Response("x", { status: 503 })) as unknown as typeof fetch;
    expect(await gateway(fetchFn).enviar(payload)).toEqual({ ok: false, erro: "GDF respondeu HTTP 503" });
  });

  it("não lança em falha de rede ou timeout", async () => {
    const rede = vi.fn(async () => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch;
    expect(await gateway(rede).enviar(payload)).toMatchObject({ ok: false, erro: expect.stringMatching(/rede/) });
    const timeout = vi.fn(async () =>
      Promise.reject(new DOMException("t", "TimeoutError")),
    ) as unknown as typeof fetch;
    expect(await gateway(timeout).enviar(payload)).toMatchObject({ ok: false, erro: expect.stringMatching(/Tempo/) });
  });
});

describe("chaveValida", () => {
  const req = (auth?: string) => new Request("http://x", { headers: auth ? { authorization: auth } : {} });
  it("aceita só a chave exata", () => {
    expect(chaveValida(req("Bearer segredo"), "segredo")).toBe(true);
    expect(chaveValida(req("Bearer segred0"), "segredo")).toBe(false);
    expect(chaveValida(req("Bearer segredo-maior"), "segredo")).toBe(false);
    expect(chaveValida(req("segredo"), "segredo")).toBe(false);
    expect(chaveValida(req(), "segredo")).toBe(false);
  });
});
