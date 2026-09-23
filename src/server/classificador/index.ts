// Ponto de entrada: tenta o LLM local e cai nas regras em qualquer falha.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { OllamaClassificador } from "./ollama";
import { RegrasClassificador } from "./regras";
import type { CategoriaInfo, Classificador, SugestaoClassificacao } from "./tipos";

export type { CategoriaInfo, Classificador, SugestaoClassificacao } from "./tipos";

const categoriasJsonSchema = z.object({
  categorias: z.array(
    z.object({
      slug: z.string(),
      nome: z.string(),
      descricao: z.string(),
      orgaoPadrao: z.string(),
      palavrasChave: z.array(z.string()),
    }),
  ),
});

let categoriasCache: CategoriaInfo[] | undefined;

/** Categorias de referência (data/categorias.json), mesma fonte do seed. */
export function carregarCategorias(): CategoriaInfo[] {
  categoriasCache ??= categoriasJsonSchema.parse(
    JSON.parse(readFileSync(join(process.cwd(), "data", "categorias.json"), "utf-8")),
  ).categorias;
  return categoriasCache;
}

export class ClassificadorComFallback implements Classificador {
  readonly nome: string;

  constructor(
    private readonly principal: Classificador | null,
    private readonly fallback: Classificador,
    private readonly onFalha: (erro: unknown) => void = () => {},
  ) {
    this.nome = principal ? `${principal.nome}+${fallback.nome}` : fallback.nome;
  }

  async classificar(descricao: string): Promise<SugestaoClassificacao> {
    if (this.principal) {
      try {
        return await this.principal.classificar(descricao);
      } catch (erro) {
        this.onFalha(erro);
      }
    }
    return this.fallback.classificar(descricao);
  }
}

export function criarClassificador(env: NodeJS.ProcessEnv = process.env): Classificador {
  const categorias = carregarCategorias();
  const regras = new RegrasClassificador(categorias);
  const modelo = env.OLLAMA_MODEL?.trim();
  const llm = modelo
    ? new OllamaClassificador(categorias, {
        url: env.OLLAMA_URL || "http://localhost:11434",
        modelo,
        timeoutMs: Number(env.CLASSIFICADOR_TIMEOUT_MS) || 8000,
      })
    : null;
  // Loga só o tipo do erro — nunca o texto da denúncia (pode conter dados pessoais).
  return new ClassificadorComFallback(llm, regras, (erro) =>
    console.warn(`[classificador] LLM indisponível, usando regras: ${erro instanceof Error ? erro.name : "erro"}`),
  );
}
