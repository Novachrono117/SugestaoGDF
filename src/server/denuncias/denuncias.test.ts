// Integração com banco SQLite real (cópia do modelo migrado + seed de referência).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { criarBancoDeTeste } from "@/test/db";
import type { CallbackGdf, PayloadGdfV1 } from "@/lib/validation/integracao-gdf";
import type { Classificador, SugestaoClassificacao } from "../classificador";
import type { GovGateway, ResultadoEnvio } from "../gov-gateway";
import { aplicarEventoGdf } from "../integracao/callback-gdf";
import { criarDenuncia, type CriarDenunciaDeps } from "./criar";
import { reenviarPendentes } from "./envio-gdf";

const banco = criarBancoDeTeste();
const db = banco.db;
afterAll(() => banco.fechar());

const sugestaoIluminacao: SugestaoClassificacao = {
  categoriaSlug: "iluminacao-publica",
  orgaoSigla: "CEB-IPES",
  confianca: 0.9,
  justificativa: "Poste sem luz.",
  alternativas: [],
  origem: "LLM",
  modelo: "modelo-teste",
};

const classificadorFixo: Classificador = { nome: "fixo", classificar: async () => sugestaoIluminacao };

function gatewayQueResponde(resultado: ResultadoEnvio) {
  const enviados: PayloadGdfV1[] = [];
  const gateway: GovGateway = {
    enviar: vi.fn(async (p: PayloadGdfV1) => {
      enviados.push(p);
      return resultado;
    }),
  };
  return { gateway, enviados };
}

function deps(gateway: GovGateway): CriarDenunciaDeps {
  return { db, gateway, classificador: classificadorFixo, appUrl: "http://voz.test", agora: () => new Date("2026-09-23T15:00:00Z") };
}

const entrada = {
  descricao: "O poste da minha rua está apagado há uma semana",
  categoriaSlug: "iluminacao-publica",
  raCodigo: "RA-IX",
  latitude: -15.82,
  longitude: -48.11,
  enderecoReferencia: "QNM 12",
};

let cidadaId: string;
beforeAll(async () => {
  cidadaId = (
    await db.usuario.create({ data: { nome: "Teste", email: "t@vozdf.example", senhaHash: "x", papel: "CIDADAO" } })
  ).id;
});

describe("criarDenuncia", () => {
  it("gera protocolos sequenciais, grava sugestão e envia ao GDF sem dados pessoais", async () => {
    const { gateway, enviados } = gatewayQueResponde({ ok: true, idExterno: "gdf-1" });

    const a = await criarDenuncia(deps(gateway), entrada, cidadaId);
    const b = await criarDenuncia(deps(gateway), { ...entrada, categoriaSlug: "seguranca-espacos-publicos" }, null);

    expect(a).toEqual({ protocolo: "DF-2026-000001", enviadaAoGdf: true });
    expect(b.protocolo).toBe("DF-2026-000002");

    const salva = await db.denuncia.findUniqueOrThrow({
      where: { protocolo: a.protocolo },
      include: { sugestao: true, eventos: { orderBy: { criadoEm: "asc" } }, envio: true },
    });
    expect(salva.status).toBe("ENVIADA_GDF");
    expect(salva.orgaoResponsavelId).toBeNull(); // a IA nunca define o responsável
    expect(salva.sugestao).toMatchObject({ confianca: 0.9, origem: "LLM", cidadaoConfirmou: true });
    expect(salva.eventos.map((e) => e.tipo)).toEqual(["CRIADA", "ENVIADA_GDF"]);
    expect(salva.envio).toMatchObject({ tentativas: 1, ultimoErro: null });

    expect(enviados[0]).toMatchObject({ protocolo: a.protocolo, anonima: false });
    expect(JSON.stringify(enviados[0])).not.toMatch(/t@vozdf\.example|Teste/);
    // b: cidadão trocou a categoria sugerida
    expect(enviados[1]).toMatchObject({ anonima: true, sugestaoIA: { cidadaoConfirmou: false } });
  });

  it("mantém a denúncia RECEBIDA quando o GDF falha e reenvia depois", async () => {
    const falha = gatewayQueResponde({ ok: false, erro: "GDF respondeu HTTP 503" });
    const { protocolo, enviadaAoGdf } = await criarDenuncia(deps(falha.gateway), entrada, null);
    expect(enviadaAoGdf).toBe(false);

    let salva = await db.denuncia.findUniqueOrThrow({ where: { protocolo }, include: { envio: true, eventos: true } });
    expect(salva.status).toBe("RECEBIDA");
    expect(salva.envio).toMatchObject({ tentativas: 1, ultimoErro: "GDF respondeu HTTP 503", enviadoEm: null });
    expect(salva.eventos.find((e) => e.tipo === "FALHA_ENVIO")?.publico).toBe(false);

    const ok = gatewayQueResponde({ ok: true, idExterno: null });
    const r = await reenviarPendentes({ db, gateway: ok.gateway, appUrl: "http://voz.test" });
    expect(r).toEqual({ pendentes: 1, enviadas: 1 });

    salva = await db.denuncia.findUniqueOrThrow({ where: { protocolo }, include: { envio: true, eventos: true } });
    expect(salva.status).toBe("ENVIADA_GDF");
    expect(salva.envio).toMatchObject({ tentativas: 2, ultimoErro: null });
  });

  it("rejeita RA ou categoria inexistente", async () => {
    const { gateway } = gatewayQueResponde({ ok: true, idExterno: null });
    await expect(criarDenuncia(deps(gateway), { ...entrada, raCodigo: "RA-XCIX" }, null)).rejects.toMatchObject({
      code: "RA_INVALIDA",
    });
    await expect(criarDenuncia(deps(gateway), { ...entrada, categoriaSlug: "nao-existe" }, null)).rejects.toMatchObject({
      code: "CATEGORIA_INVALIDA",
    });
  });
});

describe("aplicarEventoGdf", () => {
  async function denunciaEnviada() {
    const { gateway } = gatewayQueResponde({ ok: true, idExterno: null });
    return (await criarDenuncia(deps(gateway), entrada, null)).protocolo;
  }
  let seq = 0;
  const evento = (protocolo: string, extra: Pick<CallbackGdf, "status"> & Partial<CallbackGdf>): CallbackGdf => ({
    eventoId: `evt-${++seq}`,
    protocolo,
    ocorridoEm: "2026-09-24T10:00:00.000Z",
    ...extra,
  });

  it("aplica o ciclo completo e só o GDF define o órgão responsável", async () => {
    const protocolo = await denunciaEnviada();
    await aplicarEventoGdf(db, evento(protocolo, { status: "EM_ANALISE" }));
    await aplicarEventoGdf(db, evento(protocolo, { status: "ENCAMINHADA", orgaoSigla: "CEB-IPES" }));
    await aplicarEventoGdf(db, evento(protocolo, { status: "EM_EXECUCAO" }));
    await aplicarEventoGdf(db, evento(protocolo, { status: "RESOLVIDA", texto: "Lâmpada trocada." }));

    const d = await db.denuncia.findUniqueOrThrow({
      where: { protocolo },
      include: { orgaoResponsavel: true, eventos: { where: { ator: "GDF" } } },
    });
    expect(d.status).toBe("RESOLVIDA");
    expect(d.orgaoResponsavel?.sigla).toBe("CEB-IPES");
    expect(d.resolvidoEm?.toISOString()).toBe("2026-09-24T10:00:00.000Z");
    expect(d.eventos.map((e) => e.statusPara)).toEqual(["EM_ANALISE", "ENCAMINHADA", "EM_EXECUCAO", "RESOLVIDA"]);
  });

  it("ignora evento repetido (idempotência)", async () => {
    const protocolo = await denunciaEnviada();
    const e = evento(protocolo, { status: "EM_ANALISE" });
    expect(await aplicarEventoGdf(db, e)).toEqual({ aplicado: true });
    expect(await aplicarEventoGdf(db, e)).toEqual({ aplicado: false, motivo: "DUPLICADO" });
    expect(await db.eventoDenuncia.count({ where: { eventoExternoId: e.eventoId } })).toBe(1);
  });

  it("rejeita transição inválida, órgão inexistente e protocolo desconhecido", async () => {
    const protocolo = await denunciaEnviada();
    await expect(
      aplicarEventoGdf(db, evento(protocolo, { status: "RESOLVIDA", texto: "x" })),
    ).rejects.toMatchObject({ code: "TRANSICAO_INVALIDA", status: 409 });
    await expect(
      aplicarEventoGdf(db, evento(protocolo, { status: "ENCAMINHADA", orgaoSigla: "NAO-EXISTE" })),
    ).rejects.toMatchObject({ code: "ORGAO_INVALIDO", status: 422 });
    await expect(
      aplicarEventoGdf(db, evento("DF-2026-999999", { status: "EM_ANALISE" })),
    ).rejects.toMatchObject({ code: "PROTOCOLO_NAO_ENCONTRADO", status: 404 });

    const d = await db.denuncia.findUniqueOrThrow({ where: { protocolo } });
    expect(d.status).toBe("ENVIADA_GDF"); // nada foi aplicado
  });

  it("rejeita evento do GDF antes de a denúncia ser enviada", async () => {
    const { gateway } = gatewayQueResponde({ ok: false, erro: "falha" });
    const { protocolo } = await criarDenuncia(deps(gateway), entrada, null);
    await expect(aplicarEventoGdf(db, evento(protocolo, { status: "EM_ANALISE" }))).rejects.toMatchObject({
      code: "TRANSICAO_INVALIDA",
    });
  });
});
