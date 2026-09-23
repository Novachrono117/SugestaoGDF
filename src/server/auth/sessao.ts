// Data Access Layer de autenticação: toda checagem de identidade/papel passa por aqui.
// Relê o usuário no banco a cada requisição (memoizado por render), então papel revogado ou
// usuário removido perde acesso na hora, sem esperar o JWT expirar.
import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { db } from "../db";
import { erroJson } from "../http";
import { buscarUsuarioSessao, type UsuarioSessao } from "./usuarios";

export const obterUsuarioAtual = cache(async (): Promise<UsuarioSessao | null> => {
  const session = await auth();
  const id = session?.user?.id;
  return id ? buscarUsuarioSessao(db, id) : null;
});

/** Para páginas: redireciona ao login se não autenticado (ou sem o papel exigido). */
export async function exigirUsuario(papel?: UsuarioSessao["papel"], voltarPara = "/"): Promise<UsuarioSessao> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect(`/entrar?voltar=${encodeURIComponent(voltarPara)}`);
  if (papel && usuario.papel !== papel) redirect("/?erro=acesso-negado");
  return usuario;
}

/** Para route handlers: devolve o usuário ou a Response 401/403 pronta. */
export async function usuarioOuErro(
  papel?: UsuarioSessao["papel"],
): Promise<{ usuario: UsuarioSessao; erro?: never } | { usuario?: never; erro: Response }> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) return { erro: erroJson(401, "NAO_AUTENTICADO", "Faça login para continuar.") };
  if (papel && usuario.papel !== papel) return { erro: erroJson(403, "ACESSO_NEGADO", "Sem permissão para esta ação.") };
  return { usuario };
}
