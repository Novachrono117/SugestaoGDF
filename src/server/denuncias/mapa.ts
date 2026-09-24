// Pontos do mapa público. Privacidade (LGPD):
// - coordenadas ARREDONDADAS (~100 m): o ponto exato pode apontar a casa de quem denunciou ou de
//   quem foi denunciado (ex.: som alto do vizinho);
// - sem descrição, endereço de referência ou qualquer dado do autor;
// - fora do mapa: NAO_PROCEDENTE (pode ser falsa/ofensiva) e DUPLICADA.
import { z } from "zod";
import { ROTULO_STATUS, type Status } from "@/domain/status";
import type { PrismaClient } from "../../../generated/prisma/client";

const CASAS_DECIMAIS_PUBLICAS = 3; // 0,001° ≈ 110 m de latitude no DF
const LIMITE_PONTOS = 1000;

export function arredondarCoordenada(valor: number, casas = CASAS_DECIMAIS_PUBLICAS): number {
  const f = 10 ** casas;
  return Math.round(valor * f) / f;
}

const STATUS_FORA_DO_MAPA: Status[] = ["NAO_PROCEDENTE", "DUPLICADA"];

export const filtrosMapaSchema = z.object({
  ra: z.string().regex(/^RA-[IVXL]+$/).optional().catch(undefined),
  categoria: z.string().max(60).optional().catch(undefined),
  situacao: z.enum(["abertas", "resolvidas", "todas"]).default("todas").catch("todas"),
});

export type FiltrosMapa = z.infer<typeof filtrosMapaSchema>;

export type PontoPublico = {
  protocolo: string;
  latitude: number;
  longitude: number;
  status: Status;
  statusRotulo: string;
  categoria: string;
  ra: string;
  criadoEm: string;
  totalApoios: number;
};

export async function pontosPublicos(db: PrismaClient, filtros: FiltrosMapa): Promise<PontoPublico[]> {
  const status =
    filtros.situacao === "resolvidas"
      ? { equals: "RESOLVIDA" as const }
      : filtros.situacao === "abertas"
        ? { notIn: [...STATUS_FORA_DO_MAPA, "RESOLVIDA" as const] }
        : { notIn: STATUS_FORA_DO_MAPA };

  const linhas = await db.denuncia.findMany({
    where: {
      status,
      ...(filtros.ra && { ra: { codigo: filtros.ra } }),
      ...(filtros.categoria && { categoria: { slug: filtros.categoria } }),
    },
    orderBy: { criadoEm: "desc" },
    take: LIMITE_PONTOS,
    select: {
      protocolo: true,
      latitude: true,
      longitude: true,
      status: true,
      criadoEm: true,
      categoria: { select: { nome: true } },
      ra: { select: { nome: true } },
      _count: { select: { apoios: true } },
    },
  });

  return linhas.map((d) => ({
    protocolo: d.protocolo,
    latitude: arredondarCoordenada(d.latitude),
    longitude: arredondarCoordenada(d.longitude),
    status: d.status,
    statusRotulo: ROTULO_STATUS[d.status],
    categoria: d.categoria.nome,
    ra: d.ra.nome,
    criadoEm: d.criadoEm.toISOString(),
    totalApoios: d._count.apoios,
  }));
}
