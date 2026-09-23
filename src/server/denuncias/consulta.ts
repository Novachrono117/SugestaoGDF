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
