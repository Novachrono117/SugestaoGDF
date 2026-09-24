import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarBancoDeTeste } from "@/test/db";
import { consultarPorProtocolo, detalheDoAutor, listarDoAutor } from "./consulta";
import { criarDenuncia } from "./criar";

const banco = await criarBancoDeTeste();
afterAll(() => banco.fechar());

let autora: string;
let outra: string;
let protocolo: string;

beforeAll(async () => {
  const db = banco.db;
  autora = (await db.usuario.create({ data: { nome: "Autora", email: "a@vozdf.example", senhaHash: "x" } })).id;
  outra = (await db.usuario.create({ data: { nome: "Outra", email: "o@vozdf.example", senhaHash: "x" } })).id;
  const r = await criarDenuncia(
    {
      db,
      appUrl: "http://voz.test",
      gateway: { enviar: async () => ({ ok: true, idExterno: null }), enviarAvaliacao: async () => ({ ok: true, idExterno: null }) },
      classificador: {
        nome: "fixo",
        classificar: async () => ({
          categoriaSlug: "buracos-vias", orgaoSigla: "NOVACAP", confianca: 0.8,
          justificativa: "x", alternativas: [], origem: "REGRAS", modelo: "r",
        }),
      },
    },
    { descricao: "Buraco na frente da casa do Sr. José", categoriaSlug: "buracos-vias", raCodigo: "RA-III",
      latitude: -15.83, longitude: -48.05, enderecoReferencia: "QNA 20" },
    autora,
    [{ token: "t".repeat(32), caminho: "x.jpg", mime: "image/jpeg", tamanho: 10 }],
  );
  protocolo = r.protocolo;
});

describe("privacidade das consultas", () => {
  it("consulta pública não traz descrição, endereço, coordenadas nem autor", async () => {
    const c = await consultarPorProtocolo(banco.db, protocolo);
    const json = JSON.stringify(c);
    expect(c?.status).toBe("ENVIADA_GDF");
    expect(json).not.toContain("José");
    expect(json).not.toContain("QNA 20");
    expect(json).not.toMatch(/latitude|longitude|autor|email|Autora/);
  });

  it("detalhe completo só para a autora", async () => {
    expect(await detalheDoAutor(banco.db, protocolo, autora)).toMatchObject({
      descricao: expect.stringContaining("José"),
      anexos: [{ token: "t".repeat(32) }],
    });
    expect(await detalheDoAutor(banco.db, protocolo, outra)).toBeNull();
  });

  it("lista só as denúncias da própria pessoa", async () => {
    expect((await listarDoAutor(banco.db, autora)).map((d) => d.protocolo)).toEqual([protocolo]);
    expect(await listarDoAutor(banco.db, outra)).toEqual([]);
  });
});
