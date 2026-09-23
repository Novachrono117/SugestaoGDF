// Ciclo completo em processo, sem HTTP: cidadão → push → simulador → decisão → callback → cidadão.
import { afterAll, describe, expect, it, vi } from "vitest";
import { callbackGdfSchema } from "@/lib/validation/integracao-gdf";
import { criarBancoDeTeste } from "@/test/db";
import { consultarPorProtocolo } from "../server/denuncias/consulta";
import { criarDenuncia } from "../server/denuncias/criar";
import { ErroDominio } from "../server/erros";
import type { GovGateway } from "../server/gov-gateway";
import { aplicarEventoGdf } from "../server/integracao/callback-gdf";
import { receberManifestacao } from "./receber";
import { decidir, obterManifestacao, opcoesDeStatus, resumo } from "./servico";

const banco = criarBancoDeTeste();
const db = banco.db;
afterAll(() => banco.fechar());

// Push "entregue" direto ao simulador.
const gateway: GovGateway = { enviar: async (p) => ({ ok: true, ...(await receberManifestacao(db, p)) }) };

// Callback "entregue" direto ao Voz DF, com as mesmas validações do route handler.
const fetchCallback = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
  try {
    const r = await aplicarEventoGdf(db, callbackGdfSchema.parse(JSON.parse(String(init?.body))));
    return Response.json(r);
  } catch (e) {
    const status = e instanceof ErroDominio ? e.status : 500;
    return Response.json({ error: { code: "X", message: e instanceof Error ? e.message : "erro" } }, { status });
  }
}) as unknown as typeof fetch;

const deps = { db, chaveCallback: "k", fetchFn: fetchCallback };

async function novaDenuncia() {
  return criarDenuncia(
    {
      db,
      gateway,
      appUrl: "http://voz.test",
      classificador: {
        nome: "fixo",
        classificar: async () => ({
          categoriaSlug: "iluminacao-publica", orgaoSigla: "CEB-IPES", confianca: 0.9,
          justificativa: "Poste apagado.", alternativas: [], origem: "LLM", modelo: "m",
        }),
      },
    },
    { descricao: "Poste apagado na quadra 12 há dias", categoriaSlug: "iluminacao-publica", raCodigo: "RA-IX",
      latitude: -15.82, longitude: -48.11, enderecoReferencia: null },
    null,
  );
}

describe("ciclo cidadão ⇄ GDF (simulador)", () => {
  it("o GDF decide o órgão e o cidadão acompanha até Resolvida", async () => {
    const { protocolo } = await novaDenuncia();
    expect((await obterManifestacao(db, protocolo))?.status).toBe("RECEBIDA");
    expect(opcoesDeStatus("RECEBIDA")).toContain("ENCAMINHADA");

    // O operador troca o órgão sugerido pela IA (a decisão é do GDF).
    await decidir(deps, { protocolo, status: "ENCAMINHADA", orgaoSigla: "NOVACAP", texto: "Encaminhado à Novacap." });
    await decidir(deps, { protocolo, status: "EM_EXECUCAO" });
    await decidir(deps, { protocolo, status: "RESOLVIDA", texto: "Reparo concluído." });

    const cidadao = await consultarPorProtocolo(db, protocolo);
    expect(cidadao?.status).toBe("RESOLVIDA");
    expect(cidadao?.orgaoResponsavel?.sigla).toBe("NOVACAP");
    expect(cidadao?.orgaoSugeridoIA?.sigla).toBe("CEB-IPES");
    expect(cidadao?.historico.at(-1)).toMatchObject({ status: "RESOLVIDA", texto: "Reparo concluído.", ator: "GDF" });

    const m = await obterManifestacao(db, protocolo);
    expect(m).toMatchObject({ status: "RESOLVIDA", orgaoDecididoSigla: "NOVACAP" });

    const r = await resumo(db);
    expect(r.concordanciaIA).toEqual({ decididas: 1, iguais: 0 });
  });

  it("valida a decisão antes de chamar o Voz DF", async () => {
    const { protocolo } = await novaDenuncia();
    vi.mocked(fetchCallback).mockClear();
    await expect(decidir(deps, { protocolo, status: "ENCAMINHADA" })).rejects.toMatchObject({ code: "ORGAO_OBRIGATORIO" });
    await expect(decidir(deps, { protocolo, status: "RESOLVIDA", texto: "x" })).rejects.toMatchObject({
      code: "TRANSICAO_INVALIDA",
    });
    expect(fetchCallback).not.toHaveBeenCalled();
  });

  it("não altera o simulador se o Voz DF recusar ou estiver fora do ar", async () => {
    const { protocolo } = await novaDenuncia();
    const fora = vi.fn(async () => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch;
    await expect(decidir({ ...deps, fetchFn: fora }, { protocolo, status: "EM_ANALISE" })).rejects.toMatchObject({
      code: "CALLBACK_FALHOU",
    });
    const recusa = vi.fn(async () =>
      Response.json({ error: { code: "CONFLITO", message: "mudou" } }, { status: 409 }),
    ) as unknown as typeof fetch;
    await expect(decidir({ ...deps, fetchFn: recusa }, { protocolo, status: "EM_ANALISE" })).rejects.toMatchObject({
      code: "CALLBACK_RECUSADO",
    });
    expect((await obterManifestacao(db, protocolo))?.status).toBe("RECEBIDA");
  });
});
