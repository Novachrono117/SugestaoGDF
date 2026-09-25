// Ponto de entrada: tenta o LLM local e cai nas regras em qualquer falha.
import { z } from "zod";
// Import estático (entra no bundle): ler do disco via process.cwd() escaparia do rastreamento do build standalone.
import categoriasJson from "../../../data/categorias.json";
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
  categoriasCache ??= categoriasJsonSchema.parse(categoriasJson).categorias;
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
  // Loga só o tipo do erro — nunca o texto da denúncia (pode conter dados pessoais). A mensagem só
  // entra quando é nossa e segura (status HTTP do Ollama); erros de validação podem ecoar a saída do modelo.
  return new ClassificadorComFallback(llm, regras, (erro) => {
    const detalhe =
      erro instanceof Error && erro.message.startsWith("Ollama respondeu HTTP") ? erro.message : erro instanceof Error ? erro.name : "erro";
    console.warn(`[classificador] LLM indisponível, usando regras: ${detalhe}`);
  });
}
