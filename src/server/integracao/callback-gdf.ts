// Aplica um evento de status enviado pelo GDF (callback). Idempotente por eventoId.
import { validarTransicao } from "@/domain/status";
import type { CallbackGdf } from "@/lib/validation/integracao-gdf";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client";
import { enfileirarEmailDeStatus } from "../email/notificacoes";
import { ErroDominio } from "../erros";

export type ResultadoCallback = { aplicado: true } | { aplicado: false; motivo: "DUPLICADO" };

/** `notificar`: com appUrl, enfileira o e-mail ao autor na mesma transação (outbox). */
export async function aplicarEventoGdf(
  db: PrismaClient,
  evento: CallbackGdf,
  notificar?: { appUrl: string },
): Promise<ResultadoCallback> {
  const jaRecebido = await db.eventoDenuncia.findUnique({ where: { eventoExternoId: evento.eventoId } });
  if (jaRecebido) return { aplicado: false, motivo: "DUPLICADO" };

  const denuncia = await db.denuncia.findUnique({ where: { protocolo: evento.protocolo } });
  if (!denuncia) throw new ErroDominio("PROTOCOLO_NAO_ENCONTRADO", "Protocolo não encontrado.", 404);

  const transicao = validarTransicao({
    de: denuncia.status,
    para: evento.status,
    ator: "GDF",
    orgaoSigla: evento.orgaoSigla,
    texto: evento.texto,
  });
  if (!transicao.ok) {
    const status = transicao.code === "TRANSICAO_INVALIDA" ? 409 : 422;
    throw new ErroDominio(transicao.code, transicao.message, status);
  }

  let orgaoResponsavelId: string | undefined;
  if (evento.orgaoSigla) {
    const orgao = await db.orgao.findUnique({ where: { sigla: evento.orgaoSigla } });
    if (!orgao) throw new ErroDominio("ORGAO_INVALIDO", `Órgão ${evento.orgaoSigla} não cadastrado.`, 422);
    orgaoResponsavelId = orgao.id;
  }

  const ocorridoEm = new Date(evento.ocorridoEm);
  try {
    await db.$transaction(async (tx) => {
      // Concorrência otimista: só aplica se o status ainda é o que foi validado.
      const { count } = await tx.denuncia.updateMany({
        where: { id: denuncia.id, status: denuncia.status },
        data: {
          status: evento.status,
          ...(orgaoResponsavelId && { orgaoResponsavelId }),
          ...(evento.status === "RESOLVIDA" && { resolvidoEm: ocorridoEm }),
        },
      });
      if (count === 0) {
        throw new ErroDominio("CONFLITO", "A denúncia mudou de status durante o processamento; reenvie o evento.", 409);
      }
      const criado = await tx.eventoDenuncia.create({
        data: {
          denunciaId: denuncia.id,
          ator: "GDF",
          tipo: "MUDANCA_STATUS",
          statusDe: denuncia.status,
          statusPara: evento.status,
          texto: evento.texto ?? null,
          eventoExternoId: evento.eventoId,
          // criadoEm = recebimento (default now): relógio externo não define a ordem do histórico.
        },
        select: { id: true },
      });
      if (notificar) {
        await enfileirarEmailDeStatus(tx, {
          eventoId: criado.id,
          denunciaId: denuncia.id,
          status: evento.status,
          mensagemGdf: evento.texto,
          appUrl: notificar.appUrl,
        });
      }
    });
  } catch (erro) {
    // Mesmo eventoId chegando em paralelo: a unique constraint barra o segundo.
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return { aplicado: false, motivo: "DUPLICADO" };
    }
    throw erro;
  }
  return { aplicado: true };
}
