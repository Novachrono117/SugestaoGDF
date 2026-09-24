// Duplicatas por proximidade + apoios ("também tenho esse problema").
// Privacidade: a lista de próximas mostra só categoria, distância aproximada, data, status e apoios —
// nunca o relato (mesmas regras da consulta pública).
import { distanciaEmMetros } from "@/domain/geo";
import { ROTULO_STATUS, type Status } from "@/domain/status";
import { apoiosGdfSchema } from "@/lib/validation/integracao-gdf";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client";
import { ErroDominio } from "../erros";
import type { GovGateway } from "../gov-gateway";

/** Só denúncias em andamento recebem apoio e aparecem como possível duplicata. */
export const STATUS_EM_ANDAMENTO: Status[] = ["RECEBIDA", "ENVIADA_GDF", "EM_ANALISE", "ENCAMINHADA", "EM_EXECUCAO", "REABERTA"];

const RAIO_PADRAO_M = 150;
const JANELA_DIAS = 90;
const METROS_POR_GRAU_LAT = 111_320;

export type DenunciaProxima = {
  protocolo: string;
  statusRotulo: string;
  distanciaM: number; // arredondada a 10 m
  criadoEm: string;
  totalApoios: number;
};

export async function denunciasProximas(
  db: PrismaClient,
  f: { lat: number; lng: number; categoriaSlug: string; raioM?: number; agora?: Date },
): Promise<DenunciaProxima[]> {
  const raio = f.raioM ?? RAIO_PADRAO_M;
  // Caixa envolvente no SQL (usa índice/filtra barato) + distância exata em JS.
  const dLat = raio / METROS_POR_GRAU_LAT;
  const dLng = raio / (METROS_POR_GRAU_LAT * Math.cos((f.lat * Math.PI) / 180));
  const desde = new Date((f.agora ?? new Date()).getTime() - JANELA_DIAS * 24 * 60 * 60 * 1000);

  const candidatas = await db.denuncia.findMany({
    where: {
      categoria: { slug: f.categoriaSlug },
      status: { in: STATUS_EM_ANDAMENTO },
      criadoEm: { gte: desde },
      latitude: { gte: f.lat - dLat, lte: f.lat + dLat },
      longitude: { gte: f.lng - dLng, lte: f.lng + dLng },
    },
    select: { protocolo: true, status: true, criadoEm: true, latitude: true, longitude: true, _count: { select: { apoios: true } } },
    take: 50,
  });

  return candidatas
    .map((d) => ({ d, dist: distanciaEmMetros({ lat: f.lat, lng: f.lng }, { lat: d.latitude, lng: d.longitude }) }))
    .filter(({ dist }) => dist <= raio)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5)
    .map(({ d, dist }) => ({
      protocolo: d.protocolo,
      statusRotulo: ROTULO_STATUS[d.status],
      distanciaM: Math.round(dist / 10) * 10,
      criadoEm: d.criadoEm.toISOString(),
      totalApoios: d._count.apoios,
    }));
}

export type ApoioDeps = { db: PrismaClient; gateway: GovGateway };

export async function situacaoApoio(db: PrismaClient, protocolo: string, usuarioId: string | null) {
  const d = await db.denuncia.findUnique({
    where: { protocolo },
    select: {
      status: true,
      autorId: true,
      _count: { select: { apoios: true } },
      ...(usuarioId && { apoios: { where: { usuarioId }, select: { usuarioId: true } } }),
    },
  });
  if (!d) return null;
  const apoiou = Boolean(usuarioId && "apoios" in d && d.apoios.length > 0);
  const podeApoiar = Boolean(usuarioId) && !apoiou && d.autorId !== usuarioId && STATUS_EM_ANDAMENTO.includes(d.status);
  return { total: d._count.apoios, apoiou, podeApoiar, ehAutor: Boolean(usuarioId) && d.autorId === usuarioId };
}

export async function apoiar(deps: ApoioDeps, protocolo: string, usuarioId: string) {
  const d = await deps.db.denuncia.findUnique({ where: { protocolo }, select: { id: true, status: true, autorId: true } });
  if (!d) throw new ErroDominio("NAO_ENCONTRADA", "Denúncia não encontrada.", 404);
  if (d.autorId === usuarioId) throw new ErroDominio("PROPRIA_DENUNCIA", "Você não pode apoiar a sua própria denúncia.", 409);
  if (!STATUS_EM_ANDAMENTO.includes(d.status)) {
    throw new ErroDominio("DENUNCIA_ENCERRADA", "Esta denúncia não está mais em andamento.", 409);
  }
  try {
    await deps.db.apoio.create({ data: { denunciaId: d.id, usuarioId } });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      throw new ErroDominio("JA_APOIOU", "Você já apoiou esta denúncia.", 409);
    }
    throw erro;
  }
  const envio = await enviarApoiosAoGdf(deps, d.id);
  return { total: await deps.db.apoio.count({ where: { denunciaId: d.id } }), enviadoAoGdf: envio.enviado };
}

/** Informa o TOTAL atual ao GDF e marca como enviados os apoios até aqui (reenvio idempotente). */
export async function enviarApoiosAoGdf(deps: ApoioDeps, denunciaId: string) {
  const d = await deps.db.denuncia.findUniqueOrThrow({ where: { id: denunciaId }, select: { protocolo: true, status: true } });
  if (d.status === "RECEBIDA") return { enviado: false, motivo: "denúncia ainda não chegou ao GDF" };

  const agora = new Date();
  const total = await deps.db.apoio.count({ where: { denunciaId } });
  const r = await deps.gateway.enviarApoios(
    apoiosGdfSchema.parse({ versao: "1", protocolo: d.protocolo, totalApoios: total, ocorridoEm: agora.toISOString() }),
  );
  if (!r.ok) return { enviado: false, motivo: r.erro };
  await deps.db.apoio.updateMany({ where: { denunciaId, enviadoEm: null, criadoEm: { lte: agora } }, data: { enviadoEm: agora } });
  return { enviado: true };
}

export async function reenviarApoiosPendentes(deps: ApoioDeps, limite = 50) {
  const pendentes = await deps.db.apoio.findMany({
    where: { enviadoEm: null },
    distinct: ["denunciaId"],
    select: { denunciaId: true },
    take: limite,
  });
  let enviados = 0;
  for (const { denunciaId } of pendentes) if ((await enviarApoiosAoGdf(deps, denunciaId)).enviado) enviados++;
  return { pendentes: pendentes.length, enviados };
}
