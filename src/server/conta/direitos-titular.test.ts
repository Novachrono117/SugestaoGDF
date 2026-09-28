import { afterAll, describe, expect, it } from "vitest";
import type { ApoiosGdf } from "@/lib/validation/integracao-gdf";
import { criarBancoDeTeste } from "@/test/db";
import { cadastrarCidadao } from "../auth/usuarios";
import { apoiar } from "../denuncias/apoios";
import { criarDenuncia } from "../denuncias/criar";
import type { GovGateway } from "../gov-gateway";
import { excluirConta, exportarDadosDoTitular } from "./direitos-titular";

const banco = await criarBancoDeTeste();
const db = banco.db;
afterAll(() => banco.fechar());

const totaisEnviados: ApoiosGdf[] = [];
const gateway: GovGateway = {
  enviar: async () => ({ ok: true, idExterno: null }),
  enviarAvaliacao: async () => ({ ok: true, idExterno: null }),
  enviarApoios: async (a) => {
    totaisEnviados.push(a);
    return { ok: true, idExterno: null };
  },
};
const deps = { db, gateway };

async function nova(autorId: string | null, descricao = "Poste apagado na quadra 12 faz uma semana") {
  const { protocolo } = await criarDenuncia(
    {
      db,
      gateway,
      appUrl: "http://voz.test",
      classificador: {
        nome: "fixo",
        classificar: async () => ({
          categoriaSlug: "iluminacao-publica", orgaoSigla: "CEB-IPES", confianca: 0.9, justificativa: "x", alternativas: [], origem: "REGRAS", modelo: "r",
        }),
      },
    },
    { descricao, categoriaSlug: "iluminacao-publica", raCodigo: "RA-I", latitude: -15.79, longitude: -47.88, enderecoReferencia: "Qd 12" },
    autorId,
  );
  return protocolo;
}

const SENHA = "senha-ficticia-123";

describe("exportarDadosDoTitular", () => {
  it("traz conta, denúncias com relato e apoios — sem o hash da senha", async () => {
    const ana = await cadastrarCidadao(db, { nome: "Ana Fictícia", email: "ana@titular.example", senha: SENHA });
    const bia = await cadastrarCidadao(db, { nome: "Bia Fictícia", email: "bia@titular.example", senha: SENHA });
    const minha = await nova(ana.id);
    const daBia = await nova(bia.id);
    await apoiar(deps, daBia, ana.id);

    const dados = await exportarDadosDoTitular(db, ana.id);
    expect(dados.conta).toMatchObject({ nome: "Ana Fictícia", email: "ana@titular.example", papel: "CIDADAO" });
    expect(dados.denuncias).toEqual([
      expect.objectContaining({ protocolo: minha, relato: "Poste apagado na quadra 12 faz uma semana", fotos: 0 }),
    ]);
    expect(dados.apoios).toEqual([expect.objectContaining({ protocolo: daBia })]);
    const json = JSON.stringify(dados);
    expect(json).not.toMatch(/senhaHash|\$2[aby]\$/);
    expect(json).not.toContain("bia@titular.example"); // nada de outras pessoas
  });
});

describe("excluirConta", () => {
  it("exige a senha correta", async () => {
    const u = await cadastrarCidadao(db, { nome: "Caio Fictício", email: "caio@titular.example", senha: SENHA });
    await expect(excluirConta(deps, u.id, "outra-senha")).rejects.toMatchObject({ code: "SENHA_INCORRETA" });
    expect(await db.usuario.count({ where: { id: u.id } })).toBe(1);
  });

  it("apaga a conta, deixa as denúncias anônimas e reenvia o total de apoios", async () => {
    const dani = await cadastrarCidadao(db, { nome: "Dani Fictícia", email: "dani@titular.example", senha: SENHA });
    const edu = await cadastrarCidadao(db, { nome: "Edu Fictício", email: "edu@titular.example", senha: SENHA });
    const fabi = await cadastrarCidadao(db, { nome: "Fabi Fictícia", email: "fabi@titular.example", senha: SENHA });
    const minha = await nova(dani.id);
    const apoiada = await nova(edu.id);
    await apoiar(deps, apoiada, dani.id);
    await apoiar(deps, apoiada, fabi.id);
    totaisEnviados.length = 0;

    expect(await excluirConta(deps, dani.id, SENHA)).toEqual({ denunciasApoiadas: 1 });

    expect(await db.usuario.count({ where: { id: dani.id } })).toBe(0);
    const d = await db.denuncia.findUniqueOrThrow({ where: { protocolo: minha }, select: { autorId: true, descricao: true } });
    expect(d.autorId).toBeNull(); // continua existindo, sem vínculo
    expect(await db.apoio.count({ where: { denuncia: { protocolo: apoiada } } })).toBe(1);
    expect(totaisEnviados).toEqual([expect.objectContaining({ protocolo: apoiada, totalApoios: 1 })]);
    expect(await db.apoio.count({ where: { denuncia: { protocolo: apoiada }, enviadoEm: null } })).toBe(0);
  });
});
