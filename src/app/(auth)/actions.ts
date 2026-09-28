"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { signIn, signOut } from "@/auth";
import { destinoSeguro } from "@/lib/destino-seguro";
import { aceitePrivacidadeSchema, cadastroSchema } from "@/lib/validation/auth";
import { cadastrarCidadao } from "@/server/auth/usuarios";
import { db } from "@/server/db";
import { ErroDominio } from "@/server/erros";
import { limites } from "@/server/limites";
import { ipDoCliente } from "@/server/rate-limit";

// `destino` preenchido = login feito; o cliente então faz navegação completa (ver formularios.tsx).
export type EstadoForm = { erro?: string; campos?: Record<string, string>; destino?: string } | undefined;

// Por que redirect: false — o auth() do next-auth lê a sessão de headers() (requisição original).
// Com redirect dentro da action, o Next renderiza o destino na MESMA requisição, ainda sem o cookie
// novo: a página protegida manda de volta para /entrar e o roteador entra em loop.

function mensagemDeLogin(erro: AuthError): string {
  if (erro instanceof CredentialsSignin && erro.code === "limite_tentativas") {
    return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  }
  return "E-mail ou senha incorretos.";
}

export async function entrar(_anterior: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const email = String(formData.get("email") ?? "");
  try {
    await signIn("credentials", { email, senha: formData.get("senha"), redirect: false });
  } catch (erro) {
    if (erro instanceof AuthError) return { erro: mensagemDeLogin(erro), campos: { email } };
    throw erro;
  }
  return { destino: destinoSeguro(formData.get("voltar")) };
}

export async function cadastrar(_anterior: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const bruto = { nome: formData.get("nome"), email: formData.get("email"), senha: formData.get("senha") };
  const campos = { nome: String(bruto.nome ?? ""), email: String(bruto.email ?? "") };

  if (!limites.cadastroPorIp.consumir(ipDoCliente(await headers())).ok) {
    return { erro: "Muitos cadastros a partir desta rede. Tente mais tarde.", campos };
  }
  const parsed = cadastroSchema.safeParse(bruto);
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos.", campos };
  const aceite = aceitePrivacidadeSchema.safeParse(formData.get("aceitePrivacidade"));
  if (!aceite.success) return { erro: aceite.error.issues[0]?.message, campos };

  try {
    await cadastrarCidadao(db, parsed.data);
  } catch (erro) {
    if (erro instanceof ErroDominio) return { erro: erro.message, campos };
    throw erro;
  }

  try {
    await signIn("credentials", { email: parsed.data.email, senha: parsed.data.senha, redirect: false });
  } catch (erro) {
    if (erro instanceof AuthError) return { erro: "Conta criada. Faça login para continuar.", campos };
    throw erro;
  }
  return { destino: destinoSeguro(formData.get("voltar")) };
}

export async function sair() {
  await signOut({ redirect: false }); // mesmo motivo do login: o cliente recarrega a página
}
