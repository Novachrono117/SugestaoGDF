// Administração de bancos DESCARTÁVEIS de teste/E2E no Postgres local.
// Guarda de segurança: só cria/apaga bancos com prefixo vozdf_test_ ou vozdf_e2e — nunca o de desenvolvimento.
import "dotenv/config";
import { Client } from "pg";

const NOME_PERMITIDO = /^vozdf_(test_[a-z0-9_]+|e2e)$/;

function urlBase(): URL {
  const bruto = process.env.DATABASE_URL;
  if (!bruto?.startsWith("postgres")) {
    throw new Error("DATABASE_URL precisa apontar para o Postgres (docker compose up -d). Veja o README.");
  }
  return new URL(bruto);
}

export function urlDoBanco(nome: string): string {
  const u = urlBase();
  u.pathname = `/${nome}`;
  return u.toString();
}

function exigirNomePermitido(nome: string) {
  if (!NOME_PERMITIDO.test(nome)) throw new Error(`Recusado: "${nome}" não é um banco descartável de teste.`);
}

async function comAdmin<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: urlDoBanco("postgres") });
  try {
    await c.connect();
  } catch (e) {
    throw new Error(`Postgres indisponível (${(e as Error).message}). Rode \`docker compose up -d\`.`);
  }
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

export async function recriarBanco(nome: string, template?: string) {
  exigirNomePermitido(nome);
  if (template) exigirNomePermitido(template);
  await comAdmin(async (c) => {
    await c.query(`DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`);
    // Cópias simultâneas do mesmo template podem colidir ("source database is being accessed"): tenta de novo.
    for (let tentativa = 1; ; tentativa++) {
      try {
        await c.query(`CREATE DATABASE "${nome}"${template ? ` TEMPLATE "${template}"` : ""}`);
        return;
      } catch (e) {
        if ((e as { code?: string }).code !== "55006" || tentativa >= 20) throw e;
        await new Promise((r) => setTimeout(r, 50 * tentativa));
      }
    }
  });
}

export async function apagarBanco(nome: string) {
  exigirNomePermitido(nome);
  await comAdmin((c) => c.query(`DROP DATABASE IF EXISTS "${nome}" WITH (FORCE)`));
}

export async function apagarBancosDeTeste() {
  await comAdmin(async (c) => {
    const { rows } = await c.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname LIKE 'vozdf\\_test\\_%'",
    );
    for (const { datname } of rows) {
      if (NOME_PERMITIDO.test(datname)) await c.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
    }
  });
}
