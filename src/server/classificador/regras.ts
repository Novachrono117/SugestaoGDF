// Fallback sem IA: conta palavras-chave por categoria. Fraco, mas garante que a demo nunca quebra.
import type { CategoriaInfo, Classificador, SugestaoClassificacao } from "./tipos";

export const SLUG_OUTROS = "outros";

export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class RegrasClassificador implements Classificador {
  readonly nome = "regras-palavras-chave";
  private readonly padroes: Array<{ categoria: CategoriaInfo; regexes: RegExp[] }>;

  constructor(private readonly categorias: CategoriaInfo[]) {
    // Casamento no início de palavra ("apagad" casa "apagado", "apagada").
    this.padroes = categorias.map((categoria) => ({
      categoria,
      regexes: categoria.palavrasChave.map((kw) => new RegExp(`(^|[^a-z])${escapeRegex(normalizarTexto(kw))}`)),
    }));
  }

  async classificar(descricao: string): Promise<SugestaoClassificacao> {
    const texto = normalizarTexto(descricao);
    const pontuacoes = this.padroes
      .map(({ categoria, regexes }) => ({ categoria, pontos: regexes.filter((r) => r.test(texto)).length }))
      .filter((p) => p.pontos > 0)
      .sort((a, b) => b.pontos - a.pontos);

    const outros = this.categorias.find((c) => c.slug === SLUG_OUTROS);
    const melhor = pontuacoes[0];
    if (!melhor) {
      if (!outros) throw new Error(`Categoria "${SLUG_OUTROS}" não cadastrada`);
      return this.sugestao(outros, 0.2, "Nenhuma palavra-chave reconhecida; o GDF fará a triagem.", []);
    }

    const total = pontuacoes.reduce((s, p) => s + p.pontos, 0);
    // Teto de 0.8: regra por palavra-chave nunca deve parecer tão confiável quanto uma leitura real do texto.
    const confianca = Math.min(0.8, Math.round((melhor.pontos / total) * 0.8 * 100) / 100);
    return this.sugestao(
      melhor.categoria,
      confianca,
      `Palavras-chave associadas a "${melhor.categoria.nome}".`,
      pontuacoes.slice(1, 3).map((p) => p.categoria.slug),
    );
  }

  private sugestao(
    c: CategoriaInfo,
    confianca: number,
    justificativa: string,
    alternativas: string[],
  ): SugestaoClassificacao {
    return {
      categoriaSlug: c.slug,
      orgaoSigla: c.orgaoPadrao,
      confianca,
      justificativa,
      alternativas,
      origem: "REGRAS",
      modelo: this.nome,
    };
  }
}
