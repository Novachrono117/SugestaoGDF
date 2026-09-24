// SIMULADOR GDF (demonstração): recebe o push do Voz DF como faria o sistema do governo.
// Idempotente por protocolo — um reenvio não duplica a manifestação.
import type { ApoiosGdf, AvaliacaoCidadaoGdf, PayloadGdfV1 } from "@/lib/validation/integracao-gdf";
import type { PrismaClient } from "../../generated/prisma/client";

export async function receberManifestacao(db: PrismaClient, payload: PayloadGdfV1) {
  const manifestacao = await db.manifestacaoGdf.upsert({
    where: { protocolo: payload.protocolo },
    create: { protocolo: payload.protocolo, payload: JSON.stringify(payload), status: "RECEBIDA" },
    update: {},
    select: { id: true },
  });
  return { idExterno: manifestacao.id };
}

/** Recebe a confirmação/contestação do cidadão. Contestação reabre a manifestação no "GDF". */
export async function receberAvaliacaoCidadao(db: PrismaClient, avaliacao: AvaliacaoCidadaoGdf) {
  const m = await db.manifestacaoGdf.findUnique({ where: { protocolo: avaliacao.protocolo }, select: { status: true } });
  if (!m) return null;
  await db.manifestacaoGdf.update({
    where: { protocolo: avaliacao.protocolo },
    data: {
      avaliacaoCidadao: avaliacao.avaliacao,
      justificativaCidadao: avaliacao.justificativa ?? null,
      ...(avaliacao.avaliacao === "CONTESTADA" && { status: "REABERTA" }),
    },
  });
  return { ok: true };
}

/** Atualiza o total de apoios da comunidade (é o total, não incremento: reenvios não somam em dobro). */
export async function receberApoios(db: PrismaClient, apoios: ApoiosGdf) {
  const { count } = await db.manifestacaoGdf.updateMany({
    where: { protocolo: apoios.protocolo },
    data: { totalApoios: apoios.totalApoios },
  });
  return count ? { ok: true } : null;
}
