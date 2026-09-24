// E-mail a cada mudança de status (docs/ARQUITETURA.md): fila no banco (outbox) + envio assíncrono.
import { createTransport } from "nodemailer";
import { montarEmailMudancaStatus } from "@/domain/email-status";
import type { Status } from "@/domain/status";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client";

export interface EnviadorEmail {
  enviar(msg: { para: string; assunto: string; texto: string }): Promise<void>;
}

export type ConfigSmtp = {
  host: string;
  port: number;
  seguro: boolean;
  usuario?: string;
  senha?: string;
  remetente: string;
};

export function criarEnviadorSmtp(c: ConfigSmtp): EnviadorEmail {
  const transporte = createTransport({
    host: c.host,
    port: c.port,
    secure: c.seguro,
    ...(c.usuario && { auth: { user: c.usuario, pass: c.senha } }),
    connectionTimeout: 10_000,
  });
  return {
    async enviar({ para, assunto, texto }) {
      await transporte.sendMail({ from: c.remetente, to: para, subject: assunto, text: texto });
    },
  };
}

/**
 * Enfileira o e-mail NA MESMA transação da mudança de status (outbox): não existe status novo sem
 * e-mail pendente, nem e-mail de mudança que não foi gravada. Só para autor com conta e com a
 * notificação ativa; denúncia anônima não gera e-mail.
 */
export async function enfileirarEmailDeStatus(
  tx: Prisma.TransactionClient,
  dados: { eventoId: string; denunciaId: string; status: Status; mensagemGdf?: string | null; appUrl: string },
) {
  const d = await tx.denuncia.findUniqueOrThrow({
    where: { id: dados.denunciaId },
    select: {
      protocolo: true,
      orgaoResponsavel: { select: { sigla: true, nome: true } },
      autor: { select: { id: true, notificarPorEmail: true } },
    },
  });
  if (!d.autor?.notificarPorEmail) return null;

  const { assunto, texto } = montarEmailMudancaStatus({
    protocolo: d.protocolo,
    status: dados.status,
    orgao: dados.status === "ENCAMINHADA" ? d.orgaoResponsavel : null,
    mensagemGdf: dados.mensagemGdf,
    appUrl: dados.appUrl,
  });
  return tx.notificacaoEmail.create({
    data: { usuarioId: d.autor.id, eventoId: dados.eventoId, assunto, texto },
    select: { id: true },
  });
}

const MAX_TENTATIVAS = 5;

/** Envia os e-mails pendentes (chamado via after() no callback e no "Reenviar pendentes"). */
export async function processarEmailsPendentes(deps: { db: PrismaClient; enviador: EnviadorEmail | null }, limite = 50) {
  if (!deps.enviador) return { pendentes: 0, enviados: 0, semSmtp: true };
  const pendentes = await deps.db.notificacaoEmail.findMany({
    where: { enviadoEm: null, tentativas: { lt: MAX_TENTATIVAS } },
    orderBy: { criadoEm: "asc" },
    take: limite,
    select: { id: true, assunto: true, texto: true, usuario: { select: { email: true, notificarPorEmail: true } } },
  });

  let enviados = 0;
  for (const n of pendentes) {
    // Desativou depois de enfileirado: não envia (registra o motivo e tira da fila).
    if (!n.usuario.notificarPorEmail) {
      await deps.db.notificacaoEmail.update({
        where: { id: n.id },
        data: { tentativas: MAX_TENTATIVAS, ultimoErro: "Notificações desativadas pelo usuário" },
      });
      continue;
    }
    try {
      await deps.enviador.enviar({ para: n.usuario.email, assunto: n.assunto, texto: n.texto });
      await deps.db.notificacaoEmail.update({
        where: { id: n.id },
        data: { enviadoEm: new Date(), tentativas: { increment: 1 }, ultimoErro: null },
      });
      enviados++;
    } catch (erro) {
      await deps.db.notificacaoEmail.update({
        where: { id: n.id },
        // Só o tipo do erro: a mensagem do SMTP pode conter o endereço de e-mail.
        data: { tentativas: { increment: 1 }, ultimoErro: erro instanceof Error ? erro.name : "erro" },
      });
    }
  }
  return { pendentes: pendentes.length, enviados, semSmtp: false };
}
