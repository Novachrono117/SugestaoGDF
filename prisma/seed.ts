// Popula o banco com os dados de referência (data/*.json) e usuários fictícios.
// Idempotente: pode rodar várias vezes (upsert).
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createPrismaClient } from "../src/server/db";

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

async function main() {
  const senhaDemo = process.env.SEED_SENHA_DEMO;
  if (!senhaDemo || senhaDemo.length < 8) {
    throw new Error("Defina SEED_SENHA_DEMO no .env (mínimo 8 caracteres).");
  }

  const db = createPrismaClient();
  const { regioes } = readJson("regioes-administrativas.json", regioesSchema);
  const { orgaos, categorias } = readJson("categorias.json", categoriasSchema);

  for (const ra of regioes) {
    await db.regiaoAdministrativa.upsert({ where: { codigo: ra.codigo }, update: ra, create: ra });
  }

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

  // Usuários fictícios (domínio reservado .example — RFC 2606).
  const senhaHash = await bcrypt.hash(senhaDemo, 10);
  const usuarios = [
    { nome: "Operador GDF (fictício)", email: "operador@vozdf.example", papel: "OPERADOR_GDF" as const },
    { nome: "Cidadã Teste (fictícia)", email: "cidada@vozdf.example", papel: "CIDADAO" as const },
  ];
  for (const u of usuarios) {
    await db.usuario.upsert({ where: { email: u.email }, update: { ...u, senhaHash }, create: { ...u, senhaHash } });
  }

  console.log(
    `Seed ok: ${regioes.length} RAs, ${orgaos.length} órgãos, ${categorias.length} categorias, ${usuarios.length} usuários.`,
  );
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
