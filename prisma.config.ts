import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // process.env (e não env()) para `prisma generate` funcionar no postinstall sem .env.
    url: process.env["DATABASE_URL"],
  },
});
