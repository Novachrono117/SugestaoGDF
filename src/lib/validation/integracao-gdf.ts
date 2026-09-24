// Contrato da integração Voz DF ⇄ GDF (docs/ARQUITETURA.md §2).
// Usado por quem envia (Voz DF), por quem recebe (simulador) e no callback.
import { z } from "zod";
import type { Status } from "@/domain/status";
import { PROTOCOLO_REGEX } from "@/domain/protocolo";

const protocolo = z.string().regex(PROTOCOLO_REGEX, "Protocolo inválido");

// strict(): payload não pode carregar campos extras (ex.: dados pessoais adicionados por engano).
export const payloadGdfV1Schema = z
  .object({
    versao: z.literal("1"),
    protocolo,
    criadoEm: z.iso.datetime(),
    descricao: z.string().min(1).max(4000),
    categoria: z.object({ slug: z.string(), nome: z.string() }).strict(),
    local: z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        enderecoReferencia: z.string().max(300).nullable(),
        ra: z.object({ codigo: z.string(), nome: z.string() }).strict(),
      })
      .strict(),
    anexos: z.array(z.object({ url: z.url(), mime: z.string() }).strict()).max(3),
    sugestaoIA: z
      .object({
        categoriaSlug: z.string(),
        orgao: z.object({ sigla: z.string(), nome: z.string() }).strict(),
        confianca: z.number().min(0).max(1),
        justificativa: z.string(),
        origem: z.enum(["LLM", "REGRAS"]),
        modelo: z.string(),
        cidadaoConfirmou: z.boolean(),
      })
      .strict(),
    anonima: z.boolean(),
    callbackUrl: z.url(),
  })
  .strict();

export type PayloadGdfV1 = z.infer<typeof payloadGdfV1Schema>;

// Status que o GDF pode informar (RECEBIDA/ENVIADA_GDF são internos do Voz DF).
export const STATUS_INFORMADOS_PELO_GDF = [
  "EM_ANALISE",
  "ENCAMINHADA",
  "EM_EXECUCAO",
  "RESOLVIDA",
  "NAO_PROCEDENTE",
  "DUPLICADA",
] as const satisfies readonly Status[];

export const callbackGdfSchema = z.object({
  eventoId: z.string().min(1).max(100),
  // Opcional por compatibilidade: eventos sem "tipo" são mudanças de status.
  tipo: z.literal("STATUS").optional(),
  protocolo,
  status: z.enum(STATUS_INFORMADOS_PELO_GDF),
  orgaoSigla: z.string().min(1).max(30).optional(),
  texto: z.string().max(2000).optional(),
  ocorridoEm: z.iso.datetime(),
});

export type CallbackGdf = z.infer<typeof callbackGdfSchema>;

/** GDF → Voz DF: o operador avaliou se a IA acertou a categoria (base para medir/melhorar a IA). */
export const avaliacaoIaGdfSchema = z
  .object({
    eventoId: z.string().min(1).max(100),
    tipo: z.literal("AVALIACAO_IA"),
    protocolo,
    acertou: z.boolean(),
    categoriaCorretaSlug: z.string().min(1).max(60).optional(),
    ocorridoEm: z.iso.datetime(),
  })
  .refine((e) => e.acertou || e.categoriaCorretaSlug, {
    message: "Informe a categoria correta quando a IA errou.",
    path: ["categoriaCorretaSlug"],
  });

export type AvaliacaoIaGdf = z.infer<typeof avaliacaoIaGdfSchema>;

/** Tudo o que o endpoint de callback aceita. */
export const entradaCallbackGdfSchema = z.union([avaliacaoIaGdfSchema, callbackGdfSchema]);

/** Voz DF → GDF: o autor confirmou ou contestou a resolução. */
export const avaliacaoCidadaoGdfSchema = z
  .object({
    versao: z.literal("1"),
    eventoId: z.string().min(1).max(100),
    protocolo,
    avaliacao: z.enum(["CONFIRMADA", "CONTESTADA"]),
    justificativa: z.string().min(1).max(2000).optional(),
    ocorridoEm: z.iso.datetime(),
  })
  .strict()
  .refine((a) => a.avaliacao === "CONFIRMADA" || a.justificativa, {
    message: "Contestação exige justificativa.",
    path: ["justificativa"],
  });

export type AvaliacaoCidadaoGdf = z.infer<typeof avaliacaoCidadaoGdfSchema>;

/** Voz DF → GDF: total atual de apoios da comunidade (total, não incremento: reenvio é idempotente). */
export const apoiosGdfSchema = z
  .object({
    versao: z.literal("1"),
    protocolo,
    totalApoios: z.number().int().min(0),
    ocorridoEm: z.iso.datetime(),
  })
  .strict();

export type ApoiosGdf = z.infer<typeof apoiosGdfSchema>;
