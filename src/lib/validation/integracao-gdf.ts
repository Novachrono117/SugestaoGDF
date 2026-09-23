// Contrato da integração Voz DF ⇄ GDF (docs/ARQUITETURA.md §2).
// Usado por quem envia (Voz DF), por quem recebe (simulador) e no callback.
import { z } from "zod";
import { STATUS } from "@/domain/status";
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
const STATUS_GDF = STATUS.filter((s) => s !== "RECEBIDA" && s !== "ENVIADA_GDF") as [
  (typeof STATUS)[number],
  ...(typeof STATUS)[number][],
];

export const callbackGdfSchema = z.object({
  eventoId: z.string().min(1).max(100),
  protocolo,
  status: z.enum(STATUS_GDF),
  orgaoSigla: z.string().min(1).max(30).optional(),
  texto: z.string().max(2000).optional(),
  ocorridoEm: z.iso.datetime(),
});

export type CallbackGdf = z.infer<typeof callbackGdfSchema>;
