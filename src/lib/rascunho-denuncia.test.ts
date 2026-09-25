import { describe, expect, it } from "vitest";
import {
  CHAVE_RASCUNHO,
  VALIDADE_RASCUNHO_MS,
  apagarRascunho,
  lerRascunho,
  salvarRascunho,
  type DadosRascunho,
} from "./rascunho-denuncia";

function memoria() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const dados: DadosRascunho = {
  passo: 2,
  descricao: "Poste apagado na quadra 10 há uma semana",
  sugestao: {
    categoriaSlug: "iluminacao-publica", orgaoSigla: "CEB", confianca: 0.9, justificativa: "x", alternativas: [], origem: "LLM", modelo: "m",
  },
  categoriaSlug: "iluminacao-publica",
  ponto: { lat: -15.8, lng: -47.9 },
  raCodigo: "RA-I",
  endereco: "",
  anonima: false,
};

describe("rascunho da denúncia", () => {
  it("salva e recupera o que foi preenchido", () => {
    const s = memoria();
    salvarRascunho(s, dados, 1000);
    expect(lerRascunho(s, 2000)).toEqual({ versao: 1, salvoEm: 1000, ...dados });
  });

  it("não guarda formulário vazio e apaga o anterior", () => {
    const s = memoria();
    salvarRascunho(s, dados);
    salvarRascunho(s, { ...dados, descricao: "  ", ponto: null, endereco: "" });
    expect(s.m.has(CHAVE_RASCUNHO)).toBe(false);
  });

  it("expira depois de 7 dias", () => {
    const s = memoria();
    salvarRascunho(s, dados, 0);
    expect(lerRascunho(s, VALIDADE_RASCUNHO_MS + 1)).toBeNull();
    expect(s.m.has(CHAVE_RASCUNHO)).toBe(false);
  });

  it("descarta conteúdo inválido ou de outra versão", () => {
    const s = memoria();
    s.setItem(CHAVE_RASCUNHO, "{não é json");
    expect(lerRascunho(s)).toBeNull();
    s.setItem(CHAVE_RASCUNHO, JSON.stringify({ versao: 2, descricao: "x" }));
    expect(lerRascunho(s)).toBeNull();
    expect(s.m.has(CHAVE_RASCUNHO)).toBe(false);
  });

  it("sem sugestão da IA volta para o primeiro passo", () => {
    const s = memoria();
    salvarRascunho(s, { ...dados, sugestao: null, passo: 3 });
    expect(lerRascunho(s)?.passo).toBe(0);
  });

  it("storage bloqueado não quebra", () => {
    const quebrado = {
      getItem: () => { throw new Error("bloqueado"); },
      setItem: () => { throw new Error("cheio"); },
      removeItem: () => { throw new Error("bloqueado"); },
    };
    expect(() => salvarRascunho(quebrado, dados)).not.toThrow();
    expect(lerRascunho(quebrado)).toBeNull();
    expect(() => apagarRascunho(quebrado)).not.toThrow();
  });
});
