// Detecção da RA pelo ponto marcado no mapa. Limites carregados do banco uma vez por processo
// (37 polígonos simplificados, ~360 KB). Sem limites (ras:baixar não rodado) → sempre null.
import { caixaDaGeometria, detectarRa, type Geometria, type RegiaoComLimite } from "@/domain/geo";
import type { PrismaClient } from "../../generated/prisma/client";

const cache = new WeakMap<PrismaClient, Promise<RegiaoComLimite[]>>();

async function carregar(db: PrismaClient): Promise<RegiaoComLimite[]> {
  const linhas = await db.regiaoAdministrativa.findMany({
    where: { limite: { not: { equals: null } } },
    select: { codigo: true, nome: true, limite: true },
  });
  return linhas.map((r) => {
    const geometria = r.limite as unknown as Geometria;
    return { codigo: r.codigo, nome: r.nome, geometria, caixa: caixaDaGeometria(geometria) };
  });
}

export function limitesDasRas(db: PrismaClient): Promise<RegiaoComLimite[]> {
  let p = cache.get(db);
  if (!p) {
    p = carregar(db);
    cache.set(db, p);
    p.catch(() => cache.delete(db)); // falha de banco não fica "presa" no cache
  }
  return p;
}

export async function detectarRaPorPonto(db: PrismaClient, lat: number, lng: number) {
  return detectarRa(lat, lng, await limitesDasRas(db));
}
