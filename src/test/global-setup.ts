// Prepara uma vez o banco-modelo dos testes de integração: aplica as migrações e o seed de referência.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { seedReferencia } from "../../prisma/seed-referencia";
import { createPrismaClient } from "../server/prisma";

export const TMP_DIR = join(process.cwd(), ".tmp");
export const TEMPLATE_DB = join(TMP_DIR, "test-template.db");

export default async function setup() {
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });
  const url = `file:${TEMPLATE_DB}`;
  execFileSync(process.execPath, [join("node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  const db = createPrismaClient(url);
  await seedReferencia(db);
  await db.$disconnect();
  return () => rmSync(TMP_DIR, { recursive: true, force: true });
}
