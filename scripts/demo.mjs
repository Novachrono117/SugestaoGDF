// Apresentação com a turma testando pelo celular (docs/DEMO.md).
//   npm run demo:preparar  → recria o banco vozdf_demo (migrações + seed + dados fictícios) e compila o app
//   npm run demo           → sobe o app na rede, tenta o túnel da Cloudflare, aquece a IA e abre os QR codes
// Não toca no banco de desenvolvimento. Sem `cloudflared` instalado, mostra só os endereços da rede local.
import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import pg from "pg";
import QRCode from "qrcode";

const BANCO = "vozdf_demo"; // só este nome é recriado — nunca o banco de desenvolvimento
const PORTA = Number(process.env.DEMO_PORTA || 3000);
const DIST = ".next-demo";
// 127.0.0.1 e não "localhost": no Windows, localhost tenta IPv6 primeiro e cada requisição perde ~2 s.
const LOCAL = `http://127.0.0.1:${PORTA}`;

if (!process.env.DATABASE_URL?.startsWith("postgres")) {
  console.error("[demo] DATABASE_URL do .env precisa apontar para o Postgres (docker compose up -d).");
  process.exit(1);
}
const urlDoBanco = (nome) => Object.assign(new URL(process.env.DATABASE_URL), { pathname: `/${nome}` }).toString();

const env = {
  ...process.env,
  DATABASE_URL: urlDoBanco(BANCO),
  NEXT_DIST_DIR: DIST,
  PORT: String(PORTA),
  HOSTNAME: "::", // IPv4 + IPv6: celulares da rede local, túnel e o navegador do notebook (localhost) sem atraso
  // Callback do simulador e links internos ficam em localhost (o app fala com ele mesmo). O login usa o
  // endereço de quem acessa (túnel ou IP da rede), por isso AUTH_URL fica de fora e o host é confiável.
  APP_URL: LOCAL,
  AUTH_TRUST_HOST: "true",
  GDF_WEBHOOK_URL: `${LOCAL}/api/simulador-gdf/manifestacoes`,
  UPLOAD_DIR: resolve(".tmp/demo-uploads"),
  RATE_LIMIT_FATOR: process.env.RATE_LIMIT_FATOR || "20", // a turma sai pela mesma rede (mesmo IP)
  OLLAMA_KEEP_ALIVE: process.env.OLLAMA_KEEP_ALIVE || "4h", // modelo não descarrega entre um teste e outro
  CLASSIFICADOR_TIMEOUT_MS: process.env.CLASSIFICADOR_TIMEOUT_MS || "15000", // folga com vários celulares ao mesmo tempo
  SEED_USUARIOS_DEMO: "true",
};
delete env.AUTH_URL;
delete env.NODE_ENV;

const PRISMA = "node_modules/prisma/build/index.js";
const NEXT = "node_modules/next/dist/bin/next";
const TSX = "node_modules/tsx/dist/cli.mjs";

function rodar(cli, args, extra = {}) {
  const r = spawnSync(process.execPath, [cli, ...args], { env: { ...env, ...extra }, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`[demo] falhou: ${cli} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

async function preparar() {
  const admin = new pg.Client({ connectionString: urlDoBanco("postgres") });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${BANCO}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${BANCO}"`);
  await admin.end();
  rmSync(".tmp/demo-uploads", { recursive: true, force: true });

  rodar(PRISMA, ["migrate", "deploy"]);
  rodar(PRISMA, ["db", "seed"]);
  // A primeira chamada carrega o modelo a frio (~20 s): folga só nesta etapa.
  rodar(TSX, ["scripts/demo-dados.ts"], { CLASSIFICADOR_TIMEOUT_MS: "90000" });
  rodar(NEXT, ["build"]);
  cpSync("public", `${DIST}/standalone/public`, { recursive: true });
  cpSync(`${DIST}/static`, `${DIST}/standalone/${DIST}/static`, { recursive: true });
  console.log("\n[demo] Pronto. Para apresentar: npm run demo");
}

function ipsDaRede() {
  return Object.entries(networkInterfaces())
    .flatMap(([nome, lista]) => (lista ?? []).map((i) => ({ nome, ...i })))
    // Fora: adaptadores virtuais (WSL, Docker, VMs) — nenhum celular alcança esses IPs.
    .filter((i) => i.family === "IPv4" && !i.internal && !i.address.startsWith("169.254."))
    .filter((i) => !/vethernet|wsl|docker|virtualbox|vmware|hyper-v|loopback/i.test(i.nome))
    .map((i) => ({ nome: i.nome, url: `http://${i.address}:${PORTA}` }));
}

async function esperar(url, ms) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(4000) })).ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function acharCloudflared() {
  const candidatos = [
    "cloudflared",
    `${process.env.ProgramFiles}\\cloudflared\\cloudflared.exe`,
    `${process.env["ProgramFiles(x86)"]}\\cloudflared\\cloudflared.exe`,
    `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Links\\cloudflared.exe`,
  ];
  return candidatos.find((c) => spawnSync(c, ["--version"], { stdio: "ignore" }).status === 0);
}

/** Túnel rápido (sem conta): o endereço muda a cada execução, por isso o QR é gerado agora. */
function abrirTunel(exe, filhos) {
  return new Promise((ok) => {
    const t = spawn(exe, ["tunnel", "--no-autoupdate", "--url", LOCAL], { stdio: ["ignore", "pipe", "pipe"] });
    filhos.push(t);
    const tempo = setTimeout(() => ok(null), 45_000);
    const ler = (buf) => {
      const m = String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m) {
        clearTimeout(tempo);
        ok(m[0]);
      }
    };
    t.stdout.on("data", ler);
    t.stderr.on("data", ler);
    t.on("exit", () => ok(null));
  });
}

async function aquecerIa() {
  const modelo = env.OLLAMA_MODEL?.trim();
  if (!modelo) return "OLLAMA_MODEL vazio no .env — usando palavras-chave";
  // Carrega o modelo direto no Ollama (a frio leva ~20 s, mais que o timeout do app) e o mantém na memória.
  try {
    const url = (env.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, "");
    const r = await fetch(`${url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelo, prompt: "ok", stream: false, think: false, keep_alive: env.OLLAMA_KEEP_ALIVE, options: { num_predict: 1 } }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!r.ok) return `Ollama respondeu HTTP ${r.status} ao carregar ${modelo} (CUDA? ver docs/DEMO.md) — usando palavras-chave`;
    const ps = await (await fetch(`${url}/api/ps`)).json();
    const m = ps.models?.find((x) => x.name === modelo || x.model === modelo);
    if (m && m.size_vram < m.size) console.log("[demo] ATENÇÃO: modelo carregou (parte) na CPU, não na placa de vídeo — respostas lentas.");
  } catch {
    return "Ollama não respondeu (aberto?) — usando palavras-chave";
  }
  try {
    const r = await fetch(`${LOCAL}/api/v1/classificacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descricao: "O poste da minha rua está apagado há uma semana." }),
      signal: AbortSignal.timeout(60_000),
    });
    const s = await r.json();
    return s.origem === "LLM" ? `IA local ativa (${s.modelo})` : "IA local INDISPONÍVEL — usando palavras-chave (ver docs/DEMO.md)";
  } catch {
    return "não consegui testar a IA";
  }
}

async function paginaDosQr(publico, locais) {
  const bloco = async (titulo, url, dica) =>
    `<section><h2>${titulo}</h2>${await QRCode.toString(url, { type: "svg", margin: 1, width: 360 })}<p class="url">${url}</p><p>${dica}</p></section>`;
  const partes = [];
  if (publico) partes.push(await bloco("Qualquer rede (4G ou Wi-Fi)", publico, "Aponte a câmera do celular."));
  for (const l of locais) partes.push(await bloco(`Mesma rede do notebook (${l.nome})`, l.url, "Só funciona conectado ao mesmo Wi-Fi/hotspot."));
  mkdirSync(".tmp", { recursive: true });
  const arquivo = resolve(".tmp/demo-qr.html");
  writeFileSync(
    arquivo,
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Voz DF — teste pelo celular</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#fff;color:#0f172a;text-align:center}
h1{color:#1d4ed8;font-size:2.4rem;margin:0 0 8px}main{display:flex;flex-wrap:wrap;gap:32px;justify-content:center}
section{max-width:420px}h2{font-size:1.3rem}.url{font-family:monospace;font-size:1.1rem;word-break:break-all;font-weight:700}</style>
<h1>Voz DF — teste pelo celular</h1><p>Dados fictícios. Crie uma conta com qualquer e-mail (não precisa ser real) ou denuncie sem conta.</p>
<main>${partes.join("") || "<p>Nenhum endereço disponível: apresente pelo notebook.</p>"}</main></html>`,
  );
  return arquivo;
}

async function iniciar() {
  if (!existsSync(`${DIST}/standalone/server.js`)) {
    console.error("[demo] Rode antes: npm run demo:preparar");
    process.exit(1);
  }
  const filhos = [];
  const encerrar = () => {
    for (const f of filhos) f.kill();
    process.exit(0);
  };
  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);

  const servidor = spawn(process.execPath, [`${DIST}/standalone/server.js`], { env, stdio: "inherit" });
  filhos.push(servidor);
  servidor.on("exit", (code) => {
    console.error(`[demo] o servidor parou (código ${code}).`);
    encerrar();
  });
  if (!(await esperar(`${LOCAL}/api/health`, 60_000))) {
    console.error("[demo] O app não respondeu. O Docker (Postgres) está de pé?");
    encerrar();
  }
  console.log(`\n[demo] App no ar: ${LOCAL}`);
  console.log(`[demo] ${await aquecerIa()}`);

  let publico = null;
  const exe = acharCloudflared();
  if (!exe) {
    console.log("[demo] cloudflared não encontrado: só rede local (winget install --id Cloudflare.cloudflared).");
  } else {
    console.log("[demo] Abrindo túnel da Cloudflare…");
    publico = await abrirTunel(exe, filhos);
    if (publico && !(await esperar(`${publico}/api/health`, 40_000))) publico = null;
    console.log(publico ? `[demo] Túnel OK: ${publico}` : "[demo] Túnel indisponível (rede bloqueando?). Siga com a rede local ou só no notebook.");
  }

  const locais = ipsDaRede();
  for (const l of locais) console.log(`[demo] Rede local (${l.nome}): ${l.url}`);
  if (publico) console.log("\n" + (await QRCode.toString(publico, { type: "terminal", small: true })));
  const arquivo = await paginaDosQr(publico, locais);
  spawn("cmd", ["/c", "start", "", arquivo], { stdio: "ignore", detached: true }).unref();
  console.log(`[demo] QR codes: ${arquivo}\n[demo] Ctrl+C encerra tudo.`);
}

if (process.argv[2] === "preparar") await preparar();
else await iniciar();
