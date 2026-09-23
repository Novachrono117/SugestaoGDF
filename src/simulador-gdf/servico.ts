// SIMULADOR GDF (demonstração): o "lado do governo". Lê o que recebeu pelo push, decide órgão/status
// e informa o Voz DF pelo callback HTTP — exatamente como faria um sistema externo.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ROTULO_STATUS, proximosStatus, validarTransicao, type Status } from "@/domain/status";
import {
  STATUS_INFORMADOS_PELO_GDF,
  payloadGdfV1Schema,
  type CallbackGdf,
  type PayloadGdfV1,
} from "@/lib/validation/integracao-gdf";
import type { PrismaClient } from "../../generated/prisma/client";
import { ErroDominio } from "../server/erros";

/** No simulador, "RECEBIDA" é o estado inicial; no Voz DF ele corresponde a ENVIADA_GDF. */
export function statusNoVozDf(statusSimulador: string): Status {
  return statusSimulador === "RECEBIDA" ? "ENVIADA_GDF" : (statusSimulador as Status);
}

export function rotuloSimulador(statusSimulador: string): string {
  return statusSimulador === "RECEBIDA" ? "Nova (recebida)" : ROTULO_STATUS[statusSimulador as Status] ?? statusSimulador;
}

export type Manifestacao = {
  protocolo: string;
  status: string;
  orgaoDecididoSigla: string | null;
  recebidoEm: Date;
  atualizadoEm: Date;
  payload: PayloadGdfV1;
};

function parse(m: { payload: string } & Omit<Manifestacao, "payload">): Manifestacao {
  return { ...m, payload: payloadGdfV1Schema.parse(JSON.parse(m.payload)) };
}

export async function listarManifestacoes(db: PrismaClient, filtroStatus?: string): Promise<Manifestacao[]> {
  const linhas = await db.manifestacaoGdf.findMany({
    where: filtroStatus ? { status: filtroStatus } : undefined,
    orderBy: { recebidoEm: "desc" },
    take: 200,
  });
  return linhas.map(parse);
}

export async function obterManifestacao(db: PrismaClient, protocolo: string): Promise<Manifestacao | null> {
  const m = await db.manifestacaoGdf.findUnique({ where: { protocolo } });
  return m ? parse(m) : null;
}

function contar<T>(itens: T[], chave: (i: T) => string) {
  const mapa = new Map<string, number>();
  for (const i of itens) mapa.set(chave(i), (mapa.get(chave(i)) ?? 0) + 1);
  return [...mapa.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
}

export async function resumo(db: PrismaClient) {
  const todas = await listarManifestacoes(db);
  return {
    total: todas.length,
    porStatus: contar(todas, (m) => rotuloSimulador(m.status)),
    porRa: contar(todas, (m) => m.payload.local.ra.nome),
    porCategoria: contar(todas, (m) => m.payload.categoria.nome),
    // Quantas vezes o operador manteve o órgão sugerido pela IA (entre as já encaminhadas).
    concordanciaIA: (() => {
      const decididas = todas.filter((m) => m.orgaoDecididoSigla);
      const iguais = decididas.filter((m) => m.orgaoDecididoSigla === m.payload.sugestaoIA.orgao.sigla).length;
      return { decididas: decididas.length, iguais };
    })(),
  };
}

export function opcoesDeStatus(statusSimulador: string) {
  return proximosStatus(statusNoVozDf(statusSimulador));
}

export const decisaoSchema = z.object({
  protocolo: z.string(),
  status: z.enum(STATUS_INFORMADOS_PELO_GDF),
  orgaoSigla: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  texto: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => v || undefined),
});

export type Decisao = {
  protocolo: string;
  status: (typeof STATUS_INFORMADOS_PELO_GDF)[number];
  orgaoSigla?: string;
  texto?: string;
};

export type DecidirDeps = { db: PrismaClient; chaveCallback: string; fetchFn?: typeof fetch; timeoutMs?: number };

export async function decidir(deps: DecidirDeps, decisao: Decisao) {
  const { db } = deps;
  const m = await obterManifestacao(db, decisao.protocolo);
  if (!m) throw new ErroDominio("NAO_ENCONTRADA", "Manifestação não encontrada.", 404);

  // O "GDF" aplica as mesmas regras de transição: evita mandar ao Voz DF algo que ele recusaria.
  const t = validarTransicao({
    de: statusNoVozDf(m.status),
    para: decisao.status,
    ator: "GDF",
    orgaoSigla: decisao.orgaoSigla,
    texto: decisao.texto,
  });
  if (!t.ok) throw new ErroDominio(t.code, t.message, 422);

  const evento: CallbackGdf = {
    eventoId: `sim-${randomUUID()}`,
    protocolo: m.protocolo,
    status: decisao.status,
    ...(decisao.status === "ENCAMINHADA" && { orgaoSigla: decisao.orgaoSigla }),
    ...(decisao.texto && { texto: decisao.texto }),
    ocorridoEm: new Date().toISOString(),
  };

  let res: Response;
  try {
    res = await (deps.fetchFn ?? fetch)(m.payload.callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${deps.chaveCallback}` },
      body: JSON.stringify(evento),
      signal: AbortSignal.timeout(deps.timeoutMs ?? 5000),
    });
  } catch {
    throw new ErroDominio("CALLBACK_FALHOU", "Não foi possível avisar o Voz DF (rede/timeout). Nada foi alterado.", 502);
  }
  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    const msg = corpo?.error?.message ?? `HTTP ${res.status}`;
    throw new ErroDominio("CALLBACK_RECUSADO", `O Voz DF recusou a atualização: ${msg}`, 502);
  }

  // Só registra no "sistema do governo" depois que o Voz DF aceitou.
  await db.manifestacaoGdf.update({
    where: { protocolo: m.protocolo },
    data: {
      status: decisao.status,
      ...(decisao.status === "ENCAMINHADA" && { orgaoDecididoSigla: decisao.orgaoSigla }),
    },
  });
  return { status: decisao.status };
}
