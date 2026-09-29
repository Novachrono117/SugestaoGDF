import { describe, expect, it, vi } from "vitest";
import { ClassificadorComFallback, carregarCategorias } from "./index";
import { OllamaClassificador } from "./ollama";
import { RegrasClassificador, normalizarTexto } from "./regras";
import type { Classificador } from "./tipos";

const categorias = carregarCategorias();

describe("normalizarTexto", () => {
  it("remove acentos e caixa", () => expect(normalizarTexto("Iluminação  PÚBLICA")).toBe("iluminacao publica"));
});

describe("RegrasClassificador", () => {
  const regras = new RegrasClassificador(categorias);

  it.each([
    ["O poste da minha rua está apagado faz uma semana", "iluminacao-publica", "CEB-IPES"],
    ["Tem um buraco enorme no asfalto da via principal", "buracos-vias", "NOVACAP"],
    ["Esgoto a céu aberto na frente da escola", "agua-esgoto", "CAESB"],
    ["Vizinho com som alto todo fim de semana até de madrugada", "poluicao-sonora", "DF-LEGAL"],
  ])("%s → %s", async (texto, slug, orgao) => {
    const s = await regras.classificar(texto);
    expect(s).toMatchObject({ categoriaSlug: slug, orgaoSigla: orgao, origem: "REGRAS" });
    expect(s.confianca).toBeGreaterThan(0);
    expect(s.confianca).toBeLessThanOrEqual(0.8);
  });

  it("sem palavra-chave cai em 'outros' com confiança baixa", async () => {
    const s = await regras.classificar("Quero elogiar o atendimento");
    expect(s).toMatchObject({ categoriaSlug: "outros", orgaoSigla: "ADM-RA", confianca: 0.2 });
  });

  it("não casa no meio de palavra", async () => {
    // "cao" (cão) não deve casar dentro de "iluminacao".
    const s = await regras.classificar("iluminacao");
    expect(s.categoriaSlug).toBe("iluminacao-publica");
    expect(s.alternativas).not.toContain("animais");
  });
});

function fetchComResposta(content: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify({ message: { role: "assistant", content: JSON.stringify(content) } }), { status }),
  ) as unknown as typeof fetch;
}

describe("OllamaClassificador", () => {
  const config = { url: "http://ollama.test/", modelo: "modelo-teste", timeoutMs: 1000 };

  it("envia schema com enum de categorias e mapeia a resposta", async () => {
    const fetchFn = fetchComResposta({
      categoria: "iluminacao-publica",
      alternativas: ["seguranca-espacos-publicos", "iluminacao-publica"],
      confianca: 0.9,
      justificativa: "Poste sem luz.",
    });
    const llm = new OllamaClassificador(categorias, { ...config, fetchFn });

    const s = await llm.classificar("Poste apagado");

    expect(s).toEqual({
      categoriaSlug: "iluminacao-publica",
      orgaoSigla: "CEB-IPES",
      confianca: 0.9,
      justificativa: "Poste sem luz.",
      alternativas: ["seguranca-espacos-publicos"],
      origem: "LLM",
      modelo: "modelo-teste",
    });
    const [url, init] = vi.mocked(fetchFn).mock.calls[0];
    expect(url).toBe("http://ollama.test/api/chat");
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ model: "modelo-teste", stream: false, think: false, options: { temperature: 0 } });
    expect(body.format.properties.categoria.enum).toEqual(categorias.map((c) => c.slug));
    expect(body).not.toHaveProperty("keep_alive"); // sem config: padrão do Ollama
  });

  it("repassa keep_alive quando configurado (evento: modelo fica carregado)", async () => {
    const fetchFn = fetchComResposta({ categoria: "iluminacao-publica", alternativas: [], confianca: 0.9, justificativa: "x" });
    await new OllamaClassificador(categorias, { ...config, keepAlive: "4h", fetchFn }).classificar("Poste apagado");
    expect(JSON.parse(String(vi.mocked(fetchFn).mock.calls[0][1]?.body)).keep_alive).toBe("4h");
  });

  it("rejeita categoria fora da lista", async () => {
    const llm = new OllamaClassificador(categorias, {
      ...config,
      fetchFn: fetchComResposta({ categoria: "inventada", alternativas: [], confianca: 1, justificativa: "x" }),
    });
    await expect(llm.classificar("x")).rejects.toThrow();
  });

  it("rejeita HTTP de erro", async () => {
    const llm = new OllamaClassificador(categorias, { ...config, fetchFn: fetchComResposta({}, 500) });
    await expect(llm.classificar("x")).rejects.toThrow(/HTTP 500/);
  });

  it("exige modelo configurado", () => {
    expect(() => new OllamaClassificador(categorias, { ...config, modelo: "" })).toThrow(/OLLAMA_MODEL/);
  });
});

describe("ClassificadorComFallback", () => {
  const regras = new RegrasClassificador(categorias);
  const quebrado: Classificador = {
    nome: "quebrado",
    classificar: () => Promise.reject(new TypeError("fetch failed")),
  };

  it("usa as regras quando o LLM falha e avisa", async () => {
    const onFalha = vi.fn();
    const s = await new ClassificadorComFallback(quebrado, regras, onFalha).classificar("poste apagado");
    expect(s.origem).toBe("REGRAS");
    expect(onFalha).toHaveBeenCalledOnce();
  });

  it("usa só as regras quando não há LLM", async () => {
    const s = await new ClassificadorComFallback(null, regras).classificar("buraco na rua");
    expect(s).toMatchObject({ origem: "REGRAS", categoriaSlug: "buracos-vias" });
  });
});
