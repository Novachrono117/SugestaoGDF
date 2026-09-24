"use server";

import { revalidatePath } from "next/cache";
import { obterUsuarioAtual } from "@/server/auth/sessao";
import { db } from "@/server/db";

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
