import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarBancoDeTeste } from "@/test/db";
import { criarDenuncia } from "./criar";
import { arredondarCoordenada, filtrosMapaSchema, pontosPublicos } from "./mapa";

const banco = await criarBancoDeTeste();
const db = banco.db;
afterAll(() => banco.fechar());

async function nova(extra: { categoriaSlug: string; raCodigo: string; latitude: number; longitude: number }) {
  const r = await criarDenuncia(
    {
      db,
      appUrl: "http://voz.test",
      gateway: {
        enviar: async () => ({ ok: true, idExterno: null }),
        enviarAvaliacao: async () => ({ ok: true, idExterno: null }),
      },
      classificador: {
        nome: "fixo",
        classificar: async () => ({
          categoriaSlug: extra.categoriaSlug, orgaoSigla: "ADM-RA", confianca: 0.9,
          justificativa: "x", alternativas: [], origem: "REGRAS", modelo: "r",
        }),
      },
    },
    { descricao: "Som alto do vizinho Fulano toda noite", enderecoReferencia: "Casa 7", ...extra },
    null,
  );
  return r.protocolo;
}

let aberta: string, resolvida: string, naoProcedente: string, outraRa: string;

beforeAll(async () => {
  aberta = await nova({ categoriaSlug: "poluicao-sonora", raCodigo: "RA-IX", latitude: -15.823456, longitude: -48.112345 });
  resolvida = await nova({ categoriaSlug: "buracos-vias", raCodigo: "RA-IX", latitude: -15.83, longitude: -48.1 });
  naoProcedente = await nova({ categoriaSlug: "outros", raCodigo: "RA-IX", latitude: -15.84, longitude: -48.1 });
  outraRa = await nova({ categoriaSlug: "buracos-vias", raCodigo: "RA-III", latitude: -15.83, longitude: -48.05 });
  await db.denuncia.update({ where: { protocolo: resolvida }, data: { status: "RESOLVIDA" } });
  await db.denuncia.update({ where: { protocolo: naoProcedente }, data: { status: "NAO_PROCEDENTE" } });
});

describe("arredondarCoordenada", () => {
  it("usa 3 casas (~100 m)", () => {
    expect(arredondarCoordenada(-15.823456)).toBe(-15.823);
    expect(arredondarCoordenada(-48.1125)).toBe(-48.112);
  });
});

describe("pontosPublicos", () => {
  it("não expõe coordenada exata, relato, referência nem autor", async () => {
    const pontos = await pontosPublicos(db, filtrosMapaSchema.parse({}));
    const p = pontos.find((x) => x.protocolo === aberta)!;
    expect(p).toMatchObject({ latitude: -15.823, longitude: -48.112, status: "ENVIADA_GDF", categoria: "Poluição sonora" });
    const json = JSON.stringify(pontos);
    expect(json).not.toMatch(/Fulano|Casa 7|descricao|autor|-15\.823456/);
  });

  it("esconde não procedentes e filtra por situação, RA e categoria", async () => {
    const protocolos = async (f: object) => (await pontosPublicos(db, filtrosMapaSchema.parse(f))).map((p) => p.protocolo);

    expect(await protocolos({})).not.toContain(naoProcedente);
    expect(await protocolos({ situacao: "resolvidas" })).toEqual([resolvida]);
    expect(await protocolos({ situacao: "abertas" })).not.toContain(resolvida);
    expect(await protocolos({ ra: "RA-III" })).toEqual([outraRa]);
    expect(await protocolos({ categoria: "poluicao-sonora" })).toEqual([aberta]);
  });

  it("filtros inválidos viram 'sem filtro' em vez de erro", () => {
    expect(filtrosMapaSchema.parse({ ra: "x'; drop", situacao: "qualquer" })).toEqual({ ra: undefined, situacao: "todas" });
  });
});
