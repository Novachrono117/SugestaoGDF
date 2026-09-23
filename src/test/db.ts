// Banco isolado por arquivo de teste: cópia do modelo preparado em global-setup.ts.
import { randomUUID } from "node:crypto";
import { copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createPrismaClient } from "../server/prisma";

export function criarBancoDeTeste() {
  const tmp = join(process.cwd(), ".tmp");
  const arquivo = join(tmp, `test-${randomUUID()}.db`);
  copyFileSync(join(tmp, "test-template.db"), arquivo);
  const db = createPrismaClient(`file:${arquivo}`);
  return {
    db,
    async fechar() {
      await db.$disconnect();
      rmSync(arquivo, { force: true });
    },
  };
}
