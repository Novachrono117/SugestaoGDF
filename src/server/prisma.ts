// Fábrica do Prisma Client, sem efeitos colaterais (usada por seed, testes e pelo singleton em db.ts).
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client";

export function createPrismaClient(url = process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error("DATABASE_URL não definida");
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}
