// Sobe o app para o E2E com banco e build ISOLADOS (nunca toca no banco de desenvolvimento nem na .next do `npm run dev`):
// recria o banco vozdf_e2e (Postgres do docker compose) → migrações → seed → next build (em .next-e2e) → server.js
// standalone — o mesmo artefato que vai para a imagem Docker.
// Todos os valores abaixo são fictícios e só valem para este banco descartável.
import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

export const PORTA_E2E = Number(process.env.E2E_PORTA || 3100);
const base = `http://localhost:${PORTA_E2E}`;

const BANCO_E2E = "vozdf_e2e"; // só este nome; nunca o banco de desenvolvimento
if (!process.env.DATABASE_URL?.startsWith("postgres")) {
  console.error("[e2e] DATABASE_URL do .env precisa apontar para o Postgres (docker compose up -d).");
  process.exit(1);
}
function urlDoBanco(nome) {
  const u = new URL(process.env.DATABASE_URL);
  u.pathname = `/${nome}`;
  return u.toString();
}

const env = {
  ...process.env,
  DATABASE_URL: urlDoBanco(BANCO_E2E),
  NEXT_DIST_DIR: ".next-e2e",
  APP_URL: base,
  AUTH_URL: base,
  AUTH_SECRET: "e2e-auth-secret-somente-para-testes-0123456789",
  GDF_WEBHOOK_URL: `${base}/api/simulador-gdf/manifestacoes`,
  GDF_WEBHOOK_KEY: "e2e-chave-push-somente-para-testes-0123456789",
  GDF_CALLBACK_KEY: "e2e-chave-callback-somente-para-testes-0123456789",
  // Absoluto: o server.js standalone muda o diretório de trabalho para a própria pasta.
  UPLOAD_DIR: resolve(".tmp/e2e-uploads"),
  PORT: String(PORTA_E2E),
  // Sem LLM no E2E: classificador por regras → resultado determinístico e sem depender do Ollama.
  OLLAMA_MODEL: "",
  SEED_SENHA_DEMO: process.env.E2E_SENHA || "senha-e2e-ficticia",
  // E-mails do E2E vão para o Mailpit do docker compose (o teste confere pela API dele).
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  SMTP_SEGURO: "false",
  EMAIL_REMETENTE: "Voz DF E2E <e2e@vozdf.example>",
};
// next build/start definem o próprio NODE_ENV; herdar "test"/"development" atrapalha.
delete env.NODE_ENV;
delete env.HOSTNAME; // alguns shells definem HOSTNAME=<nome da máquina>; o server.js usaria para escutar

// Chama as CLIs direto pelo node (sem shell): igual em Windows e Linux e sem o aviso DEP0190.
const PRISMA = "node_modules/prisma/build/index.js";
const NEXT = "node_modules/next/dist/bin/next";

function rodar(cli, args) {
  const r = spawnSync(process.execPath, [cli, ...args], { env, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`[e2e] falhou: ${cli} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

const admin = new pg.Client({ connectionString: urlDoBanco("postgres") });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS "${BANCO_E2E}" WITH (FORCE)`);
await admin.query(`CREATE DATABASE "${BANCO_E2E}"`);
await admin.end();
rmSync(".tmp/e2e-uploads", { recursive: true, force: true });

rodar(PRISMA, ["migrate", "deploy"]);
rodar(PRISMA, ["db", "seed"]);
rodar(NEXT, ["build"]);

// Como no Dockerfile: o standalone não inclui public/ nem os estáticos do build.
cpSync("public", ".next-e2e/standalone/public", { recursive: true });
cpSync(".next-e2e/static", ".next-e2e/standalone/.next-e2e/static", { recursive: true });

const servidor = spawn(process.execPath, [".next-e2e/standalone/server.js"], { env, stdio: "inherit" });
servidor.on("exit", (code) => process.exit(code ?? 0));
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => servidor.kill(sinal));
