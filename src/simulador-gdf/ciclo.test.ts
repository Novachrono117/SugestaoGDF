// Ciclo completo em processo, sem HTTP: cidadão → push → simulador → decisão → callback → cidadão.
import { afterAll, describe, expect, it, vi } from "vitest";
import { entradaCallbackGdfSchema } from "@/lib/validation/integracao-gdf";
import { criarBancoDeTeste } from "@/test/db";
import { consultarPorProtocolo } from "../server/denuncias/consulta";
import { criarDenuncia } from "../server/denuncias/criar";
import { ErroDominio } from "../server/erros";
import type { GovGateway } from "../server/gov-gateway";
import { avaliarResolucao, consultarSituacaoAvaliacao } from "../server/denuncias/avaliacao-cidadao";
import { aplicarAvaliacaoIa } from "../server/integracao/avaliacao-ia";
import { aplicarEventoGdf } from "../server/integracao/callback-gdf";
import { receberAvaliacaoCidadao, receberManifestacao } from "./receber";
import { decidir, obterManifestacao, opcoesDeStatus, registrarAvaliacaoIa, resumo } from "./servico";

const banco = criarBancoDeTeste();
const db = banco.db;
afterAll(() => banco.fechar());

// Push "entregue" direto ao simulador.
const gateway: GovGateway = {
  enviar: async (p) => ({ ok: true, ...(await receberManifestacao(db, p)) }),
  enviarAvaliacao: async (a) => {
    await receberAvaliacaoCidadao(db, a);
    return { ok: true, idExterno: null };
  },
};

// Callback "entregue" direto ao Voz DF, com as mesmas validações do route handler.
const fetchCallback = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
  try {
    const e = entradaCallbackGdfSchema.parse(JSON.parse(String(init?.body)));
    return Response.json(e.tipo === "AVALIACAO_IA" ? await aplicarAvaliacaoIa(db, e) : await aplicarEventoGdf(db, e));
  } catch (e) {
    const status = e instanceof ErroDominio ? e.status : 500;
    return Response.json({ error: { code: "X", message: e instanceof Error ? e.message : "erro" } }, { status });
  }
}) as unknown as typeof fetch;

const deps = { db, chaveCallback: "k", fetchFn: fetchCallback };

async function novaDenuncia(autorId: string | null = null) {
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
    autorId,
  );
}

async function resolver(protocolo: string) {
  await decidir(deps, { protocolo, status: "ENCAMINHADA", orgaoSigla: "CEB-IPES" });
  await decidir(deps, { protocolo, status: "EM_EXECUCAO" });
  await decidir(deps, { protocolo, status: "RESOLVIDA", texto: "Lâmpada trocada." });
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

describe("avaliação da resolução pelo cidadão", () => {
  let autora: string;
  let outra: string;
  const avDeps = () => ({ db, gateway });

  it("prepara usuárias", async () => {
    autora = (await db.usuario.create({ data: { nome: "A", email: "a@ciclo.example", senhaHash: "x" } })).id;
    outra = (await db.usuario.create({ data: { nome: "B", email: "b@ciclo.example", senhaHash: "x" } })).id;
  });

  it("confirmar mantém Resolvida e avisa o GDF; não dá para avaliar duas vezes", async () => {
    const { protocolo } = await novaDenuncia(autora);
    expect(await consultarSituacaoAvaliacao(db, protocolo, autora)).toMatchObject({ pode: false, motivo: "NAO_RESOLVIDA" });
    await resolver(protocolo);
    expect(await consultarSituacaoAvaliacao(db, protocolo, autora)).toMatchObject({ pode: true });

    expect(await avaliarResolucao(avDeps(), { protocolo, usuarioId: autora, resolvido: true })).toEqual({
      tipo: "CONFIRMADA",
      enviadaAoGdf: true,
    });
    expect((await consultarPorProtocolo(db, protocolo))?.status).toBe("RESOLVIDA");
    expect((await obterManifestacao(db, protocolo))?.avaliacaoCidadao).toBe("CONFIRMADA");
    await expect(avaliarResolucao(avDeps(), { protocolo, usuarioId: autora, resolvido: true })).rejects.toMatchObject({
      code: "JA_AVALIADA",
    });
  });

  it("contestar exige justificativa, reabre e o GDF decide de novo (novo ciclo)", async () => {
    const { protocolo } = await novaDenuncia(autora);
    await resolver(protocolo);

    await expect(
      avaliarResolucao(avDeps(), { protocolo, usuarioId: autora, resolvido: false, justificativa: "curto" }),
    ).rejects.toMatchObject({ code: "JUSTIFICATIVA_OBRIGATORIA" });

    await avaliarResolucao(avDeps(), {
      protocolo,
      usuarioId: autora,
      resolvido: false,
      justificativa: "O poste voltou a apagar no dia seguinte.",
    });
    const reaberta = await consultarPorProtocolo(db, protocolo);
    expect(reaberta?.status).toBe("REABERTA");
    expect(reaberta?.resolvidoEm).toBeNull();
    expect(reaberta?.historico.at(-1)).toMatchObject({ status: "REABERTA", ator: "CIDADAO" });
    // A justificativa não vai para a linha do tempo pública (pode citar terceiros)...
    expect(JSON.stringify(reaberta)).not.toContain("voltou a apagar");
    // ...mas chega ao GDF.
    expect((await obterManifestacao(db, protocolo))?.justificativaCidadao).toContain("voltou a apagar");
    expect(await obterManifestacao(db, protocolo)).toMatchObject({ status: "REABERTA", avaliacaoCidadao: "CONTESTADA" });
    expect(opcoesDeStatus("REABERTA")).toEqual(["EM_ANALISE", "ENCAMINHADA", "NAO_PROCEDENTE"]);

    // GDF resolve de novo: a autora pode avaliar outra vez.
    await decidir(deps, { protocolo, status: "EM_ANALISE" });
    await resolver(protocolo);
    expect(await consultarSituacaoAvaliacao(db, protocolo, autora)).toMatchObject({ pode: true });
    expect((await obterManifestacao(db, protocolo))?.avaliacaoCidadao).toBeNull();
  });

  it("só a autora avalia; denúncia anônima não pode ser avaliada", async () => {
    const { protocolo } = await novaDenuncia(autora);
    await resolver(protocolo);
    await expect(avaliarResolucao(avDeps(), { protocolo, usuarioId: outra, resolvido: true })).rejects.toMatchObject({
      code: "NAO_ENCONTRADA",
    });
    const anonima = await novaDenuncia(null);
    await resolver(anonima.protocolo);
    expect(await consultarSituacaoAvaliacao(db, anonima.protocolo, autora)).toBeNull();
  });

  it("prazo de 30 dias", async () => {
    const { protocolo } = await novaDenuncia(autora);
    await resolver(protocolo);
    const daqui31dias = () => new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    await expect(
      avaliarResolucao({ ...avDeps(), agora: daqui31dias }, { protocolo, usuarioId: autora, resolvido: true }),
    ).rejects.toMatchObject({ code: "PRAZO_ENCERRADO" });
  });
});

describe("avaliação da IA pelo operador", () => {
  it("registra acerto/erro no Voz DF e no simulador", async () => {
    const a = await novaDenuncia();
    const b = await novaDenuncia();
    await registrarAvaliacaoIa(deps, { protocolo: a.protocolo, acertou: true });
    await registrarAvaliacaoIa(deps, {
      protocolo: b.protocolo,
      acertou: false,
      categoriaCorretaSlug: "seguranca-espacos-publicos",
    });

    const sa = await db.sugestaoIA.findFirstOrThrow({ where: { denuncia: { protocolo: a.protocolo } } });
    const sb = await db.sugestaoIA.findFirstOrThrow({
      where: { denuncia: { protocolo: b.protocolo } },
      include: { categoriaCorreta: true },
    });
    expect(sa).toMatchObject({ acertouSegundoGdf: true, categoriaCorretaId: null });
    expect(sb.acertouSegundoGdf).toBe(false);
    expect(sb.categoriaCorreta?.slug).toBe("seguranca-espacos-publicos");
    expect((await resumo(db)).acuraciaIA.avaliadas).toBeGreaterThanOrEqual(2);
  });

  it("recusa avaliação incoerente (errou, mas aponta a mesma categoria)", async () => {
    const { protocolo } = await novaDenuncia();
    await expect(
      registrarAvaliacaoIa(deps, { protocolo, acertou: false, categoriaCorretaSlug: "iluminacao-publica" }),
    ).rejects.toMatchObject({ code: "CALLBACK_RECUSADO" });
    expect((await obterManifestacao(db, protocolo))?.iaAcertou).toBeNull();
  });
});
