// Popula o banco com os dados de referência (data/*.json) e usuários fictícios.
// Idempotente: pode rodar várias vezes (upsert).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "../src/server/prisma";
import { seedReferencia } from "./seed-referencia";

async function main() {
  const senhaDemo = process.env.SEED_SENHA_DEMO;
  if (!senhaDemo || senhaDemo.length < 8) {
    throw new Error("Defina SEED_SENHA_DEMO no .env (mínimo 8 caracteres).");
  }

  const db = createPrismaClient();
  const ref = await seedReferencia(db);

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
    `Seed ok: ${ref.regioes} RAs (${ref.limites} com limite oficial), ${ref.orgaos} órgãos, ${ref.categorias} categorias, ${usuarios.length} usuários.`,
  );
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
