"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { destinoSeguro } from "@/lib/destino-seguro";
import { cadastroSchema } from "@/lib/validation/auth";
import { cadastrarCidadao } from "@/server/auth/usuarios";
import { db } from "@/server/db";
import { ErroDominio } from "@/server/erros";
import { limites } from "@/server/limites";
import { ipDoCliente } from "@/server/rate-limit";

export type EstadoForm = { erro?: string; campos?: Record<string, string> } | undefined;

function mensagemDeLogin(erro: AuthError): string {
  if (erro instanceof CredentialsSignin && erro.code === "limite_tentativas") {
    return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  }
  return "E-mail ou senha incorretos.";
}

export async function entrar(_anterior: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const email = String(formData.get("email") ?? "");
  try {
    await signIn("credentials", {
      email,
      senha: formData.get("senha"),
      redirectTo: destinoSeguro(formData.get("voltar")),
    });
  } catch (erro) {
    // signIn lança um redirect no sucesso: só tratamos erros de autenticação.
    if (erro instanceof AuthError) return { erro: mensagemDeLogin(erro), campos: { email } };
    throw erro;
  }
}

export async function cadastrar(_anterior: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const bruto = { nome: formData.get("nome"), email: formData.get("email"), senha: formData.get("senha") };
  const campos = { nome: String(bruto.nome ?? ""), email: String(bruto.email ?? "") };

  if (!limites.cadastroPorIp.consumir(ipDoCliente(await headers())).ok) {
    return { erro: "Muitos cadastros a partir desta rede. Tente mais tarde.", campos };
  }
  const parsed = cadastroSchema.safeParse(bruto);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", campos };

  try {
    await cadastrarCidadao(db, parsed.data);
  } catch (erro) {
    if (erro instanceof ErroDominio) return { erro: erro.message, campos };
    throw erro;
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      senha: parsed.data.senha,
      redirectTo: destinoSeguro(formData.get("voltar")),
    });
  } catch (erro) {
    if (erro instanceof AuthError) return { erro: "Conta criada. Faça login para continuar.", campos };
    throw erro;
  }
}

export async function sair() {
  await signOut({ redirectTo: "/" });
}
