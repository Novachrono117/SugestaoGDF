// Prepara uma vez o banco-modelo dos testes de integração (Postgres): migrações + seed de referência.
// Cada arquivo de teste recebe uma cópia instantânea dele (CREATE DATABASE ... TEMPLATE) — ver db.ts.
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { seedReferencia } from "../../prisma/seed-referencia";
import { createPrismaClient } from "../server/prisma";
import { apagarBancosDeTeste, recriarBanco, urlDoBanco } from "./pg-admin";

export const BANCO_TEMPLATE = "vozdf_test_template";

export default async function setup() {
  await apagarBancosDeTeste(); // sobras de execuções interrompidas
  await recriarBanco(BANCO_TEMPLATE);
  const url = urlDoBanco(BANCO_TEMPLATE);
  execFileSync(process.execPath, [join("node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  const db = createPrismaClient(url);
  await seedReferencia(db);
  await db.$disconnect(); // o template não pode ter conexões abertas para ser copiado
  return () => apagarBancosDeTeste();
}
