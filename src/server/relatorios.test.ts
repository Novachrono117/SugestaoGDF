import { afterAll, describe, expect, it } from "vitest";
import { criarBancoDeTeste } from "@/test/db";
import { receberManifestacao } from "../simulador-gdf/receber";
import { criarDenuncia } from "./denuncias/criar";
import { csvDoSimulador, indicadoresPublicos } from "./relatorios";

const banco = await criarBancoDeTeste();
const db = banco.db;
afterAll(() => banco.fechar());

async function nova(descricao: string) {
  const { protocolo } = await criarDenuncia(
    {
      db,
      appUrl: "http://voz.test",
      gateway: {
        enviar: async (p) => ({ ok: true, ...(await receberManifestacao(db, p)) }),
        enviarAvaliacao: async () => ({ ok: true, idExterno: null }),
        enviarApoios: async () => ({ ok: true, idExterno: null }),
      },
      classificador: {
        nome: "fixo",
        classificar: async () => ({
          categoriaSlug: "buracos-vias", orgaoSigla: "NOVACAP", confianca: 0.9, justificativa: "x", alternativas: [], origem: "REGRAS", modelo: "r",
        }),
      },
    },
    { descricao, categoriaSlug: "buracos-vias", raCodigo: "RA-III", latitude: -15.83, longitude: -48.05, enderecoReferencia: null },
    null,
  );
  return protocolo;
}

describe("relatórios", () => {
  it("indicadores públicos agregam sem expor relato", async () => {
    const a = await nova("Buraco na frente da casa da vizinha Joana");
    await nova("Outro buraco na pista");
    await db.denuncia.update({
      where: { protocolo: a },
      data: { status: "RESOLVIDA", resolvidoEm: new Date(Date.now() + 2 * 86_400_000) },
    });

    const r = await indicadoresPublicos(db);
    expect(r.geral).toMatchObject({ total: 2, resolvidas: 1, percentualResolvidas: 50, diasMedioResolucao: 2 });
    expect(r.porRa).toEqual([expect.objectContaining({ nome: "Taguatinga", total: 2 })]);
    expect(JSON.stringify(r)).not.toContain("Joana");
  });

  it("CSV do simulador: uma linha por manifestação, sem o relato", async () => {
    const csv = await csvDoSimulador(db);
    const linhas = csv.trim().split("\r\n");
    expect(linhas[0]).toContain('"Protocolo";"Recebida em";"Categoria";"RA"');
    expect(linhas).toHaveLength(3); // cabeçalho + 2
    expect(csv).toContain('"Buracos e pavimentação";"Taguatinga"');
    expect(csv).not.toContain("Joana");
  });
});
