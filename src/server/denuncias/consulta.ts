// Consulta pública por protocolo. O protocolo é sequencial (adivinhável), então a resposta
// NÃO inclui descrição, coordenadas exatas nem qualquer dado do denunciante.
import { ROTULO_STATUS } from "@/domain/status";
import type { PrismaClient } from "../../../generated/prisma/client";

export async function consultarPorProtocolo(db: PrismaClient, protocolo: string) {
  const d = await db.denuncia.findUnique({
    where: { protocolo },
    select: {
      protocolo: true,
      status: true,
      criadoEm: true,
      atualizadoEm: true,
      resolvidoEm: true,
      categoria: { select: { slug: true, nome: true } },
      ra: { select: { codigo: true, nome: true } },
      orgaoResponsavel: { select: { sigla: true, nome: true } },
      sugestao: { select: { orgao: { select: { sigla: true, nome: true } } } },
      _count: { select: { apoios: true } },
      eventos: {
        where: { publico: true, statusPara: { not: null } },
        orderBy: { criadoEm: "asc" },
        select: { statusPara: true, texto: true, ator: true, criadoEm: true },
      },
    },
  });
  if (!d) return null;
  return {
    protocolo: d.protocolo,
    status: d.status,
    statusRotulo: ROTULO_STATUS[d.status],
    criadoEm: d.criadoEm,
    atualizadoEm: d.atualizadoEm,
    resolvidoEm: d.resolvidoEm,
    categoria: d.categoria,
    ra: d.ra,
    orgaoResponsavel: d.orgaoResponsavel, // decisão do GDF (null até o encaminhamento)
    orgaoSugeridoIA: d.sugestao?.orgao ?? null,
    totalApoios: d._count.apoios,
    historico: d.eventos.map((e) => ({
      status: e.statusPara!,
      statusRotulo: ROTULO_STATUS[e.statusPara!],
      texto: e.texto,
      ator: e.ator,
      em: e.criadoEm,
    })),
  };
}

export type ConsultaPublica = NonNullable<Awaited<ReturnType<typeof consultarPorProtocolo>>>;

/** Descrição e fotos: só para quem fez a denúncia (nunca na consulta pública). */
export async function detalheDoAutor(db: PrismaClient, protocolo: string, usuarioId: string) {
  return db.denuncia.findFirst({
    where: { protocolo, autorId: usuarioId },
    select: {
      descricao: true,
      enderecoReferencia: true,
      anexos: { select: { token: true }, orderBy: { criadoEm: "asc" } },
    },
  });
}

export async function listarDoAutor(db: PrismaClient, usuarioId: string) {
  const denuncias = await db.denuncia.findMany({
    where: { autorId: usuarioId },
    orderBy: { criadoEm: "desc" },
    take: 100,
    select: {
      protocolo: true,
      descricao: true,
      status: true,
      criadoEm: true,
      categoria: { select: { nome: true } },
      ra: { select: { nome: true } },
    },
  });
  return denuncias.map((d) => ({ ...d, statusRotulo: ROTULO_STATUS[d.status] }));
}
