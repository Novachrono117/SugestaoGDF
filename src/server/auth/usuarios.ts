// Núcleo de autenticação, independente do Auth.js (testável com banco real).
import bcrypt from "bcryptjs";
import type { Cadastro } from "@/lib/validation/auth";
import { Prisma, type PrismaClient } from "../../../generated/prisma/client";
import { ErroDominio } from "../erros";

const CUSTO_BCRYPT = 10;
// Hash de uma senha qualquer: comparar contra ele quando o e-mail não existe iguala o tempo de
// resposta e não revela quais e-mails estão cadastrados.
const HASH_FALSO = bcrypt.hashSync("senha-inexistente-para-tempo-constante", CUSTO_BCRYPT);

export type UsuarioSessao = { id: string; nome: string; email: string; papel: "CIDADAO" | "OPERADOR_GDF" };

export async function verificarCredenciais(
  db: PrismaClient,
  email: string,
  senha: string,
): Promise<UsuarioSessao | null> {
  const usuario = await db.usuario.findUnique({ where: { email } });
  const confere = await bcrypt.compare(senha, usuario?.senhaHash ?? HASH_FALSO);
  if (!usuario || !confere) return null;
  return { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel };
}

/** Cadastro público: sempre CIDADAO (operador do simulador só via seed). */
export async function cadastrarCidadao(db: PrismaClient, dados: Cadastro): Promise<UsuarioSessao> {
  const senhaHash = await bcrypt.hash(dados.senha, CUSTO_BCRYPT);
  try {
    const u = await db.usuario.create({
      data: { nome: dados.nome, email: dados.email, senhaHash, papel: "CIDADAO" },
    });
    return { id: u.id, nome: u.nome, email: u.email, papel: u.papel };
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      throw new ErroDominio("EMAIL_EM_USO", "Já existe uma conta com este e-mail.", 409);
    }
    throw erro;
  }
}

export async function buscarUsuarioSessao(db: PrismaClient, id: string): Promise<UsuarioSessao | null> {
  return db.usuario.findUnique({ where: { id }, select: { id: true, nome: true, email: true, papel: true } });
}
