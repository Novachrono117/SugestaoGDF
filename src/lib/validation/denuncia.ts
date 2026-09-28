// Entrada da criação de denúncia (compartilhada entre o formulário e a API).
import "../zod-sem-eval";
import { z } from "zod";

// Retângulo que envolve o DF com folga — barra coordenadas absurdas; a RA é confirmada pelo cidadão.
export const LIMITES_DF = { latMin: -16.1, latMax: -15.45, lngMin: -48.35, lngMax: -47.25 } as const;

export const novaDenunciaSchema = z.object({
  descricao: z
    .string()
    .trim()
    .min(10, "Descreva o problema com pelo menos 10 caracteres.")
    .max(2000, "Descrição muito longa (máx. 2000 caracteres)."),
  categoriaSlug: z.string().min(1, "Escolha a categoria."),
  raCodigo: z.string().regex(/^RA-[IVXL]+$/, "Escolha a Região Administrativa."),
  latitude: z.coerce
    .number()
    .min(LIMITES_DF.latMin, "Local fora do DF.")
    .max(LIMITES_DF.latMax, "Local fora do DF."),
  longitude: z.coerce
    .number()
    .min(LIMITES_DF.lngMin, "Local fora do DF.")
    .max(LIMITES_DF.lngMax, "Local fora do DF."),
  enderecoReferencia: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
});

export type NovaDenuncia = z.infer<typeof novaDenunciaSchema>;

export const classificacaoSchema = z.object({
  descricao: novaDenunciaSchema.shape.descricao,
});

// Limites de fotos compartilhados entre o formulário e o servidor.
// O tamanho máximo efetivo no servidor vem de MAX_UPLOAD_MB (padrão 5).
export const FOTOS = {
  max: 3,
  maxMbPadrao: 5,
  tiposAceitos: ["image/jpeg", "image/png", "image/webp"],
} as const;
