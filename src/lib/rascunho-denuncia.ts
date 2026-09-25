// Rascunho da denúncia guardado NESTE aparelho (localStorage) para não perder o relato
// se a internet cair ou a pessoa fechar a aba. Fotos ficam de fora (File não é serializável).
// O conteúdo lido é validado: o storage pode ter versão antiga, lixo ou ter sido editado.
import { z } from "zod";

export const CHAVE_RASCUNHO = "voz-df:rascunho-denuncia";
export const VALIDADE_RASCUNHO_MS = 7 * 24 * 60 * 60 * 1000;

const sugestaoSchema = z.object({
  categoriaSlug: z.string(),
  orgaoSigla: z.string(),
  confianca: z.number(),
  justificativa: z.string(),
  alternativas: z.array(z.string()),
  origem: z.enum(["LLM", "REGRAS"]),
  modelo: z.string(),
});

const rascunhoSchema = z.object({
  versao: z.literal(1),
  salvoEm: z.number(),
  passo: z.number().int().min(0).max(3),
  descricao: z.string().max(2000),
  sugestao: sugestaoSchema.nullable(),
  categoriaSlug: z.string().max(100),
  ponto: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  raCodigo: z.string().max(20),
  endereco: z.string().max(300),
  anonima: z.boolean(),
});

export type RascunhoDenuncia = z.infer<typeof rascunhoSchema>;
export type DadosRascunho = Omit<RascunhoDenuncia, "versao" | "salvoEm">;

type Armazenamento = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Nada digitado ainda: não vale a pena guardar. */
export function rascunhoVazio(d: DadosRascunho): boolean {
  return !d.descricao.trim() && !d.ponto && !d.endereco.trim();
}

export function salvarRascunho(storage: Armazenamento, dados: DadosRascunho, agora = Date.now()): void {
  try {
    if (rascunhoVazio(dados)) return storage.removeItem(CHAVE_RASCUNHO);
    const r: RascunhoDenuncia = { versao: 1, salvoEm: agora, ...dados };
    storage.setItem(CHAVE_RASCUNHO, JSON.stringify(r));
  } catch {
    // Storage cheio ou bloqueado (modo privado): o rascunho é conveniência, não pode quebrar o envio.
  }
}

export function lerRascunho(storage: Armazenamento, agora = Date.now()): RascunhoDenuncia | null {
  try {
    const bruto = storage.getItem(CHAVE_RASCUNHO);
    if (!bruto) return null;
    const r = rascunhoSchema.safeParse(JSON.parse(bruto));
    if (!r.success || agora - r.data.salvoEm > VALIDADE_RASCUNHO_MS) {
      storage.removeItem(CHAVE_RASCUNHO);
      return null;
    }
    // Sem sugestão da IA não há como estar além do passo 1 (a escolha da categoria parte dela).
    return r.data.sugestao ? r.data : { ...r.data, passo: 0 };
  } catch {
    return null;
  }
}

export function apagarRascunho(storage: Armazenamento): void {
  try {
    storage.removeItem(CHAVE_RASCUNHO);
  } catch {
    // idem salvarRascunho
  }
}
