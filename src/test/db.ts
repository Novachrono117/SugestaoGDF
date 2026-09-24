// Banco isolado por arquivo de teste: cópia do template preparado em global-setup.ts.
import { randomUUID } from "node:crypto";
import { createPrismaClient } from "../server/prisma";
import { apagarBanco, recriarBanco, urlDoBanco } from "./pg-admin";

const BANCO_TEMPLATE = "vozdf_test_template";

export async function criarBancoDeTeste() {
  const nome = `vozdf_test_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await recriarBanco(nome, BANCO_TEMPLATE);
  const db = createPrismaClient(urlDoBanco(nome));
  return {
    db,
    async fechar() {
      await db.$disconnect();
      await apagarBanco(nome);
    },
  };
}
