// Mede acurácia e latência dos classificadores nos casos fictícios de data/casos-classificador.json.
// Uso:
//   npm run eval:classificador                      → só regras
//   npm run eval:classificador -- qwen3:4b gemma3:4b → regras + cada modelo do Ollama
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { carregarCategorias } from "../src/server/classificador";
import { OllamaClassificador } from "../src/server/classificador/ollama";
import { RegrasClassificador } from "../src/server/classificador/regras";
import type { Classificador } from "../src/server/classificador/tipos";

const casosSchema = z.object({ casos: z.array(z.object({ texto: z.string(), esperado: z.string() })) });

function percentil(valores: number[], p: number): number {
  const ord = [...valores].sort((a, b) => a - b);
  return ord[Math.min(ord.length - 1, Math.floor((p / 100) * ord.length))] ?? 0;
}

async function avaliar(classificador: Classificador, casos: z.infer<typeof casosSchema>["casos"]) {
  let acertos = 0;
  let acertosTop3 = 0;
  let falhas = 0;
  const latencias: number[] = [];
  const erros: string[] = [];

  for (const caso of casos) {
    const inicio = performance.now();
    try {
      const s = await classificador.classificar(caso.texto);
      latencias.push(performance.now() - inicio);
      if (s.categoriaSlug === caso.esperado) acertos++;
      else erros.push(`  esperado ${caso.esperado.padEnd(28)} veio ${s.categoriaSlug.padEnd(28)} "${caso.texto.slice(0, 60)}"`);
      if (s.categoriaSlug === caso.esperado || s.alternativas.includes(caso.esperado)) acertosTop3++;
    } catch (e) {
      falhas++;
      erros.push(`  FALHA (${e instanceof Error ? e.message.slice(0, 80) : "erro"}) "${caso.texto.slice(0, 60)}"`);
    }
  }

  const n = casos.length;
  const pct = (x: number) => `${((x / n) * 100).toFixed(1)}%`;
  console.log(`\n=== ${classificador.nome}`);
  console.log(`acurácia: ${pct(acertos)} (${acertos}/${n}) | acerto entre as 3 sugestões: ${pct(acertosTop3)} | falhas: ${falhas}`);
  if (latencias.length) {
    console.log(`latência: p50 ${percentil(latencias, 50).toFixed(0)} ms | p95 ${percentil(latencias, 95).toFixed(0)} ms`);
  }
  if (erros.length) console.log(`erros:\n${erros.join("\n")}`);
}

async function main() {
  const categorias = carregarCategorias();
  const { casos } = casosSchema.parse(
    JSON.parse(readFileSync(join(process.cwd(), "data", "casos-classificador.json"), "utf-8")),
  );
  const slugs = new Set(categorias.map((c) => c.slug));
  const invalidos = casos.filter((c) => !slugs.has(c.esperado));
  if (invalidos.length) throw new Error(`Casos com categoria inexistente: ${invalidos.map((c) => c.esperado).join(", ")}`);

  const url = process.env.OLLAMA_URL || "http://localhost:11434";
  const classificadores: Classificador[] = [
    new RegrasClassificador(categorias),
    ...process.argv.slice(2).map((modelo) => new OllamaClassificador(categorias, { url, modelo, timeoutMs: 60_000 })),
  ];

  console.log(`${casos.length} casos, ${categorias.length} categorias`);
  for (const c of classificadores) await avaliar(c, casos);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
