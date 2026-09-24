// Dados de referência (RAs, órgãos, categorias) a partir de data/*.json.
// Compartilhado entre o seed e os testes de integração. Idempotente (upsert).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";

const regioesSchema = z.object({
  regioes: z.array(
    z.object({ codigo: z.string(), numero: z.number().int(), nome: z.string(), slug: z.string() }),
  ),
});

const categoriasSchema = z.object({
  orgaos: z.array(z.object({ sigla: z.string(), nome: z.string() })),
  categorias: z.array(
    z.object({ slug: z.string(), nome: z.string(), descricao: z.string(), orgaoPadrao: z.string() }),
  ),
});

function readJson<T>(file: string, schema: z.ZodType<T>): T {
  return schema.parse(JSON.parse(readFileSync(join(process.cwd(), "data", file), "utf-8")));
}

export async function seedReferencia(db: PrismaClient) {
  const { regioes } = readJson("regioes-administrativas.json", regioesSchema);
  const { orgaos, categorias } = readJson("categorias.json", categoriasSchema);

  for (const ra of regioes) {
    await db.regiaoAdministrativa.upsert({ where: { codigo: ra.codigo }, update: ra, create: ra });
  }
  const limites = await gravarLimitesSeExistirem(db);

  const orgaoIdBySigla = new Map<string, string>();
  for (const o of orgaos) {
    const row = await db.orgao.upsert({ where: { sigla: o.sigla }, update: o, create: o });
    orgaoIdBySigla.set(o.sigla, row.id);
  }

  for (const c of categorias) {
    const orgaoPadraoId = orgaoIdBySigla.get(c.orgaoPadrao);
    if (!orgaoPadraoId) throw new Error(`Categoria ${c.slug}: órgão ${c.orgaoPadrao} inexistente`);
    const data = { slug: c.slug, nome: c.nome, descricao: c.descricao, orgaoPadraoId };
    await db.categoria.upsert({ where: { slug: c.slug }, update: data, create: data });
  }

  return { regioes: regioes.length, orgaos: orgaos.length, categorias: categorias.length, limites };
}

const cacheLimitesSchema = z.object({
  features: z.array(
    z.object({
      properties: z.object({ codigo: z.string() }),
      geometry: z.object({ type: z.enum(["Polygon", "MultiPolygon"]), coordinates: z.array(z.unknown()) }),
    }),
  ),
});

/** Limites oficiais das RAs, se `npm run ras:baixar` já foi rodado (arquivo fora do git). */
async function gravarLimitesSeExistirem(db: PrismaClient): Promise<number> {
  const arquivo = join(process.cwd(), "data", "cache", "ras-oficiais.geojson");
  if (!existsSync(arquivo)) return 0;
  const { features } = cacheLimitesSchema.parse(JSON.parse(readFileSync(arquivo, "utf-8")));
  for (const f of features) {
    await db.regiaoAdministrativa.update({
      where: { codigo: f.properties.codigo },
      data: { limite: f.geometry as object },
    });
  }
  return features.length;
}
