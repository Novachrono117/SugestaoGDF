"use server";

import { revalidatePath } from "next/cache";
import { obterUsuarioAtual } from "@/server/auth/sessao";
import { depsDenuncia, obterEnviadorEmail } from "@/server/container";
import { db } from "@/server/db";
import { reenviarPendentes } from "@/server/denuncias/envio-gdf";
import { processarEmailsPendentes } from "@/server/email/notificacoes";
import { serverEnv } from "@/server/env";
import { ErroDominio } from "@/server/erros";
import { avaliacaoIaSchema, decidir, decisaoSchema, registrarAvaliacaoIa } from "@/simulador-gdf/servico";

export type EstadoAcao = { erro?: string; sucesso?: string } | undefined;

async function exigirOperador(): Promise<string | null> {
  const u = await obterUsuarioAtual();
  return u?.papel === "OPERADOR_GDF" ? null : "Sem permissão para operar o simulador.";
}

export async function decidirAcao(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const negado = await exigirOperador();
  if (negado) return { erro: negado };

  const parsed = decisaoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const r = await decidir({ db, chaveCallback: serverEnv().GDF_CALLBACK_KEY }, parsed.data);
    revalidatePath("/simulador-gdf", "layout");
    return { sucesso: `Status atualizado para ${r.status}. O cidadão já vê a mudança pelo protocolo.` };
  } catch (erro) {
    if (erro instanceof ErroDominio) return { erro: erro.message };
    throw erro;
  }
}

export async function avaliarIaAcao(_anterior: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const negado = await exigirOperador();
  if (negado) return { erro: negado };

  const parsed = avaliacaoIaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await registrarAvaliacaoIa({ db, chaveCallback: serverEnv().GDF_CALLBACK_KEY }, parsed.data);
    revalidatePath("/simulador-gdf", "layout");
    return { sucesso: "Avaliação da IA registrada no Voz DF." };
  } catch (erro) {
    if (erro instanceof ErroDominio) return { erro: erro.message };
    throw erro;
  }
}

export async function reenviarAcao(): Promise<EstadoAcao> {
  const negado = await exigirOperador();
  if (negado) return { erro: negado };
  const r = await reenviarPendentes(depsDenuncia());
  const e = await processarEmailsPendentes({ db, enviador: obterEnviadorEmail() });
  revalidatePath("/simulador-gdf");
  return {
    sucesso: `${r.enviadas} de ${r.pendentes} entrega(s) ao GDF; ${e.semSmtp ? "SMTP não configurado" : `${e.enviados} de ${e.pendentes} e-mail(s)`}.`,
  };
}
