// O autor confirma ou contesta a resolução informada pelo GDF (até PRAZO_CONTESTACAO_DIAS).
// Contestar exige justificativa e reabre a denúncia (REABERTA), que volta para o GDF decidir.
import { PRAZO_CONTESTACAO_DIAS, validarTransicao } from "@/domain/status";
import { avaliacaoCidadaoGdfSchema } from "@/lib/validation/integracao-gdf";
import type { PrismaClient } from "../../../generated/prisma/client";
import { ErroDominio } from "../erros";
import type { GovGateway } from "../gov-gateway";

const DIA_MS = 24 * 60 * 60 * 1000;

export type AvaliacaoDeps = { db: PrismaClient; gateway: GovGateway; agora?: () => Date };

export type SituacaoAvaliacao =
  | { pode: true; prazoAte: Date }
  | { pode: false; motivo: "NAO_RESOLVIDA" | "PRAZO_ENCERRADO" | "JA_AVALIADA"; avaliacao?: "CONFIRMADA" | "CONTESTADA" };

/**
 * Regra pura: só denúncia RESOLVIDA, dentro do prazo e ainda não avaliada neste ciclo.
 * `resolvidaRecebidaEm` = quando o Voz DF RECEBEU a resolução (nosso relógio, não o do GDF).
 */
export function situacaoAvaliacao(
  d: { status: string; resolvidaRecebidaEm: Date | null },
  avaliacaoDoCiclo: { tipo: "CONFIRMADA" | "CONTESTADA" } | null,
  agora: Date,
): SituacaoAvaliacao {
  if (d.status !== "RESOLVIDA" || !d.resolvidaRecebidaEm) return { pode: false, motivo: "NAO_RESOLVIDA" };
  if (avaliacaoDoCiclo) return { pode: false, motivo: "JA_AVALIADA", avaliacao: avaliacaoDoCiclo.tipo };
  const prazoAte = new Date(d.resolvidaRecebidaEm.getTime() + PRAZO_CONTESTACAO_DIAS * DIA_MS);
  if (agora > prazoAte) return { pode: false, motivo: "PRAZO_ENCERRADO" };
  return { pode: true, prazoAte };
}

async function carregar(db: PrismaClient, protocolo: string, usuarioId: string) {
  const denuncia = await db.denuncia.findFirst({
    where: { protocolo, autorId: usuarioId },
    select: { id: true, protocolo: true, status: true },
  });
  if (!denuncia) return null;
  // O ciclo começa quando recebemos a última resolução (horário do nosso evento, não o do GDF).
  const ultimaResolucao = await db.eventoDenuncia.findFirst({
    where: { denunciaId: denuncia.id, statusPara: "RESOLVIDA" },
    orderBy: { criadoEm: "desc" },
    select: { criadoEm: true },
  });
  const resolvidaRecebidaEm = denuncia.status === "RESOLVIDA" ? (ultimaResolucao?.criadoEm ?? null) : null;
  // Avaliação "deste ciclo" = feita depois dessa resolução (uma reabertura inicia novo ciclo).
  const doCiclo = resolvidaRecebidaEm
    ? await db.avaliacaoCidadao.findFirst({
        where: { denunciaId: denuncia.id, criadoEm: { gte: resolvidaRecebidaEm } },
        orderBy: { criadoEm: "desc" },
        select: { tipo: true },
      })
    : null;
  return { d: { ...denuncia, resolvidaRecebidaEm }, doCiclo };
}

/** null = não é o autor (ou protocolo inexistente). */
export async function consultarSituacaoAvaliacao(db: PrismaClient, protocolo: string, usuarioId: string, agora = new Date()) {
  const r = await carregar(db, protocolo, usuarioId);
  return r ? situacaoAvaliacao(r.d, r.doCiclo, agora) : null;
}

export async function ultimaJustificativa(db: PrismaClient, protocolo: string, usuarioId: string) {
  const a = await db.avaliacaoCidadao.findFirst({
    where: { tipo: "CONTESTADA", denuncia: { protocolo, autorId: usuarioId } },
    orderBy: { criadoEm: "desc" },
    select: { justificativa: true, criadoEm: true },
  });
  return a;
}

export async function avaliarResolucao(
  deps: AvaliacaoDeps,
  input: { protocolo: string; usuarioId: string; resolvido: boolean; justificativa?: string },
) {
  const { db } = deps;
  const r = await carregar(db, input.protocolo, input.usuarioId);
  // Não revela se o protocolo existe para quem não é o autor.
  if (!r) throw new ErroDominio("NAO_ENCONTRADA", "Denúncia não encontrada entre as suas.", 404);

  const agora = deps.agora?.() ?? new Date();
  const situacao = situacaoAvaliacao(r.d, r.doCiclo, agora);
  if (!situacao.pode) {
    const msg = {
      NAO_RESOLVIDA: "Só é possível avaliar depois que o GDF marcar a denúncia como resolvida.",
      PRAZO_ENCERRADO: `O prazo de ${PRAZO_CONTESTACAO_DIAS} dias para avaliar esta resolução terminou.`,
      JA_AVALIADA: "Você já avaliou esta resolução.",
    }[situacao.motivo];
    throw new ErroDominio(situacao.motivo, msg, 409);
  }

  const justificativa = input.justificativa?.trim() || undefined;
  if (!input.resolvido) {
    if (!justificativa || justificativa.length < 10) {
      throw new ErroDominio("JUSTIFICATIVA_OBRIGATORIA", "Conte o que ainda não foi resolvido (mínimo 10 caracteres).", 422);
    }
    const t = validarTransicao({ de: "RESOLVIDA", para: "REABERTA", ator: "CIDADAO", texto: justificativa });
    if (!t.ok) throw new ErroDominio(t.code, t.message, 422);
  }

  const tipo = input.resolvido ? ("CONFIRMADA" as const) : ("CONTESTADA" as const);
  const avaliacao = await db.$transaction(async (tx) => {
    if (tipo === "CONTESTADA") {
      const { count } = await tx.denuncia.updateMany({
        where: { id: r.d.id, status: "RESOLVIDA" },
        data: { status: "REABERTA", resolvidoEm: null },
      });
      if (count === 0) throw new ErroDominio("CONFLITO", "A denúncia mudou de status; recarregue a página.", 409);
    }
    await tx.eventoDenuncia.create({
      data: {
        denunciaId: r.d.id,
        ator: "CIDADAO",
        autorId: input.usuarioId,
        tipo: tipo === "CONTESTADA" ? "MUDANCA_STATUS" : "AVALIACAO_CIDADAO",
        ...(tipo === "CONTESTADA" && { statusDe: "RESOLVIDA" as const, statusPara: "REABERTA" as const }),
        // Texto público genérico: a justificativa pode conter dados de terceiros e fica só
        // com o autor e o GDF (AvaliacaoCidadao + mensagem enviada ao GDF).
        texto:
          tipo === "CONTESTADA"
            ? "O cidadão informou que o problema não foi resolvido."
            : "O cidadão confirmou que o problema foi resolvido.",
      },
    });
    return tx.avaliacaoCidadao.create({
      data: { denunciaId: r.d.id, tipo, justificativa: tipo === "CONTESTADA" ? justificativa : null, criadoEm: agora },
      select: { id: true },
    });
  });

  // Fora da transação: falha com o GDF não desfaz a avaliação (fica pendente de reenvio).
  const envio = await enviarAvaliacaoAoGdf(deps, avaliacao.id);
  return { tipo, enviadaAoGdf: envio.enviada };
}

export async function enviarAvaliacaoAoGdf(deps: AvaliacaoDeps, avaliacaoId: string) {
  const { db, gateway } = deps;
  const a = await db.avaliacaoCidadao.findUniqueOrThrow({
    where: { id: avaliacaoId },
    include: { denuncia: { select: { protocolo: true } } },
  });
  if (a.enviadoEm) return { enviada: true };

  const mensagem = avaliacaoCidadaoGdfSchema.parse({
    versao: "1",
    eventoId: `voz-aval-${a.id}`,
    protocolo: a.denuncia.protocolo,
    avaliacao: a.tipo,
    ...(a.justificativa && { justificativa: a.justificativa }),
    ocorridoEm: a.criadoEm.toISOString(),
  });
  const r = await gateway.enviarAvaliacao(mensagem);
  await db.avaliacaoCidadao.update({
    where: { id: a.id },
    data: r.ok
      ? { enviadoEm: new Date(), tentativas: { increment: 1 }, ultimoErro: null }
      : { tentativas: { increment: 1 }, ultimoErro: r.erro },
  });
  return r.ok ? { enviada: true } : { enviada: false, erro: r.erro };
}

export async function reenviarAvaliacoesPendentes(deps: AvaliacaoDeps, limite = 50) {
  const pendentes = await deps.db.avaliacaoCidadao.findMany({
    where: { enviadoEm: null },
    orderBy: { criadoEm: "asc" },
    take: limite,
    select: { id: true },
  });
  let enviadas = 0;
  for (const { id } of pendentes) if ((await enviarAvaliacaoAoGdf(deps, id)).enviada) enviadas++;
  return { pendentes: pendentes.length, enviadas };
}
