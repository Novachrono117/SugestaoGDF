import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ApoiosGdf } from "@/lib/validation/integracao-gdf";
import { criarBancoDeTeste } from "@/test/db";
import type { GovGateway, ResultadoEnvio } from "../gov-gateway";
import { apoiar, denunciasProximas, reenviarApoiosPendentes, situacaoApoio } from "./apoios";
import { criarDenuncia } from "./criar";

const banco = await criarBancoDeTeste();
const db = banco.db;
afterAll(() => banco.fechar());

const BASE = { lat: -15.7939, lng: -47.8828 };
const apoiosEnviados: ApoiosGdf[] = [];
let respostaGdf: ResultadoEnvio = { ok: true, idExterno: null };
const gateway: GovGateway = {
  enviar: async () => ({ ok: true, idExterno: null }),
  enviarAvaliacao: async () => ({ ok: true, idExterno: null }),
  enviarApoios: vi.fn(async (a: ApoiosGdf) => {
    apoiosEnviados.push(a);
    return respostaGdf;
  }),
};

async function nova(extra: { categoriaSlug?: string; lat?: number; lng?: number; autorId?: string | null } = {}) {
  const categoriaSlug = extra.categoriaSlug ?? "iluminacao-publica";
  const { protocolo } = await criarDenuncia(
    {
      db,
      gateway,
      appUrl: "http://voz.test",
      classificador: {
        nome: "fixo",
        classificar: async () => ({
          categoriaSlug, orgaoSigla: "CEB-IPES", confianca: 0.9, justificativa: "x", alternativas: [], origem: "REGRAS", modelo: "r",
        }),
      },
    },
    { descricao: "Poste apagado em frente à casa do Seu João", categoriaSlug, raCodigo: "RA-I",
      latitude: extra.lat ?? BASE.lat, longitude: extra.lng ?? BASE.lng, enderecoReferencia: null },
    extra.autorId ?? null,
  );
  return protocolo;
}

let autora: string, vizinho: string, outro: string;
beforeAll(async () => {
  const u = (email: string) => db.usuario.create({ data: { nome: email, email, senhaHash: "x" } }).then((x) => x.id);
  [autora, vizinho, outro] = await Promise.all([u("autora@ap.example"), u("vizinho@ap.example"), u("outro@ap.example")]);
});

describe("denunciasProximas", () => {
  it("mesma categoria, em andamento, dentro do raio, sem relato; mais perto primeiro", async () => {
    const perto = await nova({ lat: BASE.lat + 0.0003 }); // ~33 m
    const longe = await nova({ lat: BASE.lat + 0.005 }); // ~550 m
    const outraCategoria = await nova({ categoriaSlug: "buracos-vias" });
    const resolvida = await nova({ lat: BASE.lat + 0.0001 });
    await db.denuncia.update({ where: { protocolo: resolvida }, data: { status: "RESOLVIDA" } });

    const lista = await denunciasProximas(db, { ...BASE, categoriaSlug: "iluminacao-publica" });
    const protocolos = lista.map((d) => d.protocolo);
    expect(protocolos).toContain(perto);
    expect(protocolos).not.toContain(longe);
    expect(protocolos).not.toContain(outraCategoria);
    expect(protocolos).not.toContain(resolvida);
    expect(lista.find((d) => d.protocolo === perto)?.distanciaM).toBe(30);
    expect(JSON.stringify(lista)).not.toMatch(/Seu João|descricao|latitude/);
  });
});

describe("apoiar", () => {
  it("1 por pessoa, não na própria, só em andamento; informa o TOTAL ao GDF", async () => {
    const protocolo = await nova({ autorId: autora });

    await expect(apoiar({ db, gateway }, protocolo, autora)).rejects.toMatchObject({ code: "PROPRIA_DENUNCIA" });
    expect(await apoiar({ db, gateway }, protocolo, vizinho)).toEqual({ total: 1, enviadoAoGdf: true });
    await expect(apoiar({ db, gateway }, protocolo, vizinho)).rejects.toMatchObject({ code: "JA_APOIOU" });
    expect(await apoiar({ db, gateway }, protocolo, outro)).toEqual({ total: 2, enviadoAoGdf: true });
    expect(apoiosEnviados.filter((a) => a.protocolo === protocolo).map((a) => a.totalApoios)).toEqual([1, 2]);

    expect(await situacaoApoio(db, protocolo, vizinho)).toMatchObject({ total: 2, apoiou: true, podeApoiar: false });
    expect(await situacaoApoio(db, protocolo, autora)).toMatchObject({ ehAutor: true, podeApoiar: false });
    expect(await situacaoApoio(db, protocolo, null)).toMatchObject({ total: 2, podeApoiar: false });

    await db.denuncia.update({ where: { protocolo }, data: { status: "NAO_PROCEDENTE" } });
    const terceiro = (await db.usuario.create({ data: { nome: "t", email: "t@ap.example", senhaHash: "x" } })).id;
    await expect(apoiar({ db, gateway }, protocolo, terceiro)).rejects.toMatchObject({ code: "DENUNCIA_ENCERRADA" });
  });

  it("GDF fora do ar: apoio fica pendente e o reenvio manda o total uma vez", async () => {
    const protocolo = await nova();
    respostaGdf = { ok: false, erro: "GDF respondeu HTTP 503" };
    expect(await apoiar({ db, gateway }, protocolo, vizinho)).toEqual({ total: 1, enviadoAoGdf: false });
    expect(await apoiar({ db, gateway }, protocolo, outro)).toEqual({ total: 2, enviadoAoGdf: false });

    respostaGdf = { ok: true, idExterno: null };
    apoiosEnviados.length = 0;
    expect(await reenviarApoiosPendentes({ db, gateway })).toEqual({ pendentes: 1, enviados: 1 });
    expect(apoiosEnviados).toEqual([expect.objectContaining({ protocolo, totalApoios: 2 })]);
    expect(await db.apoio.count({ where: { denuncia: { protocolo }, enviadoEm: null } })).toBe(0);
  });
});
