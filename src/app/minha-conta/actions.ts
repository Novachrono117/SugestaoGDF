"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signOut } from "@/auth";
import { obterUsuarioAtual } from "@/server/auth/sessao";
import { depsDenuncia } from "@/server/container";
import { excluirConta } from "@/server/conta/direitos-titular";
import { db } from "@/server/db";
import { ErroDominio } from "@/server/erros";
import { limites } from "@/server/limites";

export type EstadoConta = { sucesso?: string; erro?: string } | undefined;

export async function salvarPreferenciasAcao(_anterior: EstadoConta, formData: FormData): Promise<EstadoConta> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) return { erro: "Faça login para continuar." };
  const notificarPorEmail = formData.get("notificarPorEmail") === "on";
  await db.usuario.update({ where: { id: usuario.id }, data: { notificarPorEmail } });
  revalidatePath("/minha-conta");
  return {
    sucesso: notificarPorEmail
      ? "Pronto: você receberá um e-mail a cada atualização das suas denúncias."
      : "Pronto: você não receberá mais e-mails. Acompanhe pelo site.",
  };
}

const exclusaoSchema = z.object({
  senha: z.string().min(1, "Digite sua senha para confirmar.").max(200),
  confirmo: z.literal("on", { error: "Marque a caixa confirmando que entende o que acontece." }),
});

export type EstadoExclusao = { erro?: string } | undefined;

export async function excluirContaAcao(_anterior: EstadoExclusao, formData: FormData): Promise<EstadoExclusao> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) return { erro: "Faça login para continuar." };
  const parsed = exclusaoSchema.safeParse({ senha: formData.get("senha"), confirmo: formData.get("confirmo") });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message };
  // Mesmo limite do login: a senha pedida aqui não pode virar atalho para adivinhação.
  if (!limites.loginPorEmail.consumir(usuario.email).ok) return { erro: "Muitas tentativas. Aguarde alguns minutos." };

  try {
    await excluirConta(depsDenuncia(), usuario.id, parsed.data.senha);
  } catch (erro) {
    if (erro instanceof ErroDominio) return { erro: erro.message };
    throw erro;
  }
  await signOut({ redirect: false });
  // Aqui o redirect na action é seguro (diferente do login em (auth)/actions.ts): o destino é público e a
  // sessão relê o usuário no banco — já apagado, então a página sai deslogada. Sem ele, o Next
  // re-renderizaria /minha-conta, que mandaria para /entrar e a confirmação se perderia.
  redirect("/?conta=excluida");
}
