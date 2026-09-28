// Popula o banco com os dados de referência (data/*.json) e usuários fictícios.
// Idempotente: pode rodar várias vezes (upsert).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { createPrismaClient } from "../src/server/prisma";
import { seedReferencia } from "./seed-referencia";

// Usuários fictícios (domínio reservado .example — RFC 2606). Num uso real: SEED_USUARIOS_DEMO=false,
// contas nominais com `npm run usuario:criar` e remoção destes com `npm run usuario:remover`.
const USUARIOS_DEMO = [
  { nome: "Operador GDF (fictício)", email: "operador@vozdf.example", papel: "OPERADOR_GDF" as const },
  { nome: "Cidadã Teste (fictícia)", email: "cidada@vozdf.example", papel: "CIDADAO" as const },
];

async function main() {
  const comDemo = process.env.SEED_USUARIOS_DEMO?.trim().toLowerCase() !== "false";
  const senhaDemo = process.env.SEED_SENHA_DEMO;
  if (comDemo && (!senhaDemo || senhaDemo.length < 8)) {
    throw new Error("Defina SEED_SENHA_DEMO no .env (mínimo 8 caracteres) ou SEED_USUARIOS_DEMO=false.");
  }

  const db = createPrismaClient();
  const ref = await seedReferencia(db);

  if (comDemo) {
    const senhaHash = await bcrypt.hash(senhaDemo!, 10);
    for (const u of USUARIOS_DEMO) {
      await db.usuario.upsert({ where: { email: u.email }, update: { ...u, senhaHash }, create: { ...u, senhaHash } });
    }
  } else {
    const restantes = await db.usuario.count({ where: { email: { in: USUARIOS_DEMO.map((u) => u.email) } } });
    if (restantes) console.warn(`Aviso: ${restantes} usuário(s) de demonstração ainda existem — remova com npm run usuario:remover.`);
  }

  console.log(
    `Seed ok: ${ref.regioes} RAs (${ref.limites} com limite oficial), ${ref.orgaos} órgãos, ${ref.categorias} categorias, ` +
      (comDemo ? `${USUARIOS_DEMO.length} usuários de demonstração.` : "sem usuários de demonstração."),
  );
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
