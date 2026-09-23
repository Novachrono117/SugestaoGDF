// Singleton do Prisma para o app (route handlers / server components).
// Serviços recebem o client por parâmetro; só a borda (rotas) importa este módulo.
import type { PrismaClient } from "../../generated/prisma/client";
import { createPrismaClient } from "./prisma";

// Uma instância por processo; em dev o hot reload recriaria conexões a cada edição.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
