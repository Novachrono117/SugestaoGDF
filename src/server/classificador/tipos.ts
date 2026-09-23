// Contrato comum dos classificadores (docs/ARQUITETURA.md §3). A IA só SUGERE.

export type CategoriaInfo = {
  slug: string;
  nome: string;
  descricao: string;
  orgaoPadrao: string; // sigla
  palavrasChave: string[];
};

export type OrigemSugestao = "LLM" | "REGRAS";

export type SugestaoClassificacao = {
  categoriaSlug: string;
  orgaoSigla: string;
  /** Estimativa em [0, 1]. No LLM é autodeclarada pelo modelo — não é probabilidade calibrada. */
  confianca: number;
  justificativa: string;
  /** Até 2 outras categorias plausíveis, para o cidadão trocar com um toque. */
  alternativas: string[];
  origem: OrigemSugestao;
  modelo: string;
};

export interface Classificador {
  readonly nome: string;
  classificar(descricao: string): Promise<SugestaoClassificacao>;
}
