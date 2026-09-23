"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obterUsuarioAtual } from "@/server/auth/sessao";
import { depsDenuncia } from "@/server/container";
import { avaliarResolucao } from "@/server/denuncias/avaliacao-cidadao";
import { ErroDominio } from "@/server/erros";

export type EstadoAvaliacao = { erro?: string; justificativa?: string } | undefined;

const entradaSchema = z.object({
  protocolo: z.string().min(1),
  resolvido: z.enum(["sim", "nao"]),
  justificativa: z.string().max(2000).optional(),
});

export async function avaliarResolucaoAcao(_anterior: EstadoAvaliacao, formData: FormData): Promise<EstadoAvaliacao> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) return { erro: "Faça login para avaliar." };

  const parsed = entradaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: "Dados inválidos." };
  const { protocolo, resolvido, justificativa } = parsed.data;

  try {
    const { db, gateway } = depsDenuncia();
    await avaliarResolucao({ db, gateway }, { protocolo, usuarioId: usuario.id, resolvido: resolvido === "sim", justificativa });
  } catch (erro) {
    if (erro instanceof ErroDominio) return { erro: erro.message, justificativa };
    throw erro;
  }
  revalidatePath(`/acompanhar/${protocolo}`);
  revalidatePath("/minhas-denuncias");
}
