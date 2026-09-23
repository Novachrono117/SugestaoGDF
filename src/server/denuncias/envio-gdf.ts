// Envia uma denúncia ao GDF e registra o resultado (EnvioGdf + EventoDenuncia).
import { montarPayloadGdf } from "@/domain/payload-gdf";
import { validarTransicao } from "@/domain/status";
import { payloadGdfV1Schema } from "@/lib/validation/integracao-gdf";
import type { PrismaClient } from "../../../generated/prisma/client";
import type { GovGateway } from "../gov-gateway";
import { reenviarAvaliacoesPendentes } from "./avaliacao-cidadao";

export type EnvioDeps = { db: PrismaClient; gateway: GovGateway; appUrl: string };

export type ResultadoEnvioDenuncia = { enviada: true } | { enviada: false; erro: string };

export async function enviarDenunciaAoGdf(deps: EnvioDeps, denunciaId: string): Promise<ResultadoEnvioDenuncia> {
  const { db, gateway, appUrl } = deps;
  const d = await db.denuncia.findUniqueOrThrow({
    where: { id: denunciaId },
    include: {
      categoria: true,
      ra: true,
      anexos: { select: { token: true, mime: true }, orderBy: { criadoEm: "asc" } },
      sugestao: { include: { categoria: true, orgao: true } },
    },
  });
  if (d.status !== "RECEBIDA") return { enviada: true }; // já enviada antes (reenvio idempotente)
  if (!d.sugestao) throw new Error(`Denúncia ${d.protocolo} sem sugestão da IA`);

  const payload = payloadGdfV1Schema.parse(
    montarPayloadGdf(
      {
        protocolo: d.protocolo,
        criadoEm: d.criadoEm,
        descricao: d.descricao,
        categoria: d.categoria,
        latitude: d.latitude,
        longitude: d.longitude,
        enderecoReferencia: d.enderecoReferencia,
        ra: d.ra,
        anonima: d.autorId === null,
        anexos: d.anexos,
        sugestao: {
          categoriaSlug: d.sugestao.categoria.slug,
          orgao: { sigla: d.sugestao.orgao.sigla, nome: d.sugestao.orgao.nome },
          confianca: d.sugestao.confianca,
          justificativa: d.sugestao.justificativa,
          origem: d.sugestao.origem,
          modelo: d.sugestao.modelo,
          cidadaoConfirmou: d.sugestao.cidadaoConfirmou,
        },
      },
      appUrl,
    ),
  );

  const resultado = await gateway.enviar(payload);

  if (!resultado.ok) {
    await db.$transaction([
      db.envioGdf.update({
        where: { denunciaId },
        data: { tentativas: { increment: 1 }, ultimoErro: resultado.erro },
      }),
      db.eventoDenuncia.create({
        data: { denunciaId, ator: "SISTEMA", tipo: "FALHA_ENVIO", texto: resultado.erro, publico: false },
      }),
    ]);
    return { enviada: false, erro: resultado.erro };
  }

  const transicao = validarTransicao({ de: "RECEBIDA", para: "ENVIADA_GDF", ator: "SISTEMA" });
  if (!transicao.ok) throw new Error(transicao.message);

  await db.$transaction(async (tx) => {
    // where com status: se outra requisição já moveu a denúncia, não sobrescreve.
    const { count } = await tx.denuncia.updateMany({
      where: { id: denunciaId, status: "RECEBIDA" },
      data: { status: "ENVIADA_GDF" },
    });
    if (count === 0) return;
    await tx.envioGdf.update({
      where: { denunciaId },
      data: { tentativas: { increment: 1 }, ultimoErro: null, enviadoEm: new Date(), idExterno: resultado.idExterno },
    });
    await tx.eventoDenuncia.create({
      data: {
        denunciaId,
        ator: "SISTEMA",
        tipo: "ENVIADA_GDF",
        statusDe: "RECEBIDA",
        statusPara: "ENVIADA_GDF",
        texto: "Recebida pelo GDF.",
      },
    });
  });
  return { enviada: true };
}

/** Reprocessa entregas ao GDF que falharam (ex.: GDF fora do ar): denúncias e avaliações do cidadão. */
export async function reenviarPendentes(deps: EnvioDeps, limite = 50) {
  const pendentes = await deps.db.envioGdf.findMany({
    where: { enviadoEm: null },
    orderBy: { atualizadoEm: "asc" },
    take: limite,
    select: { denunciaId: true },
  });
  let enviadas = 0;
  for (const { denunciaId } of pendentes) {
    if ((await enviarDenunciaAoGdf(deps, denunciaId)).enviada) enviadas++;
  }
  const avaliacoes = await reenviarAvaliacoesPendentes(deps, limite);
  return { pendentes: pendentes.length + avaliacoes.pendentes, enviadas: enviadas + avaliacoes.enviadas };
}
