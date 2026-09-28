// Direitos do titular (LGPD art. 18): acesso/portabilidade (exportar) e eliminação (excluir conta).
// Ver /privacidade — o texto de lá descreve exatamente o que estas funções fazem.
import { verificarCredenciais } from "../auth/usuarios";
import { enviarApoiosAoGdf, type ApoioDeps } from "../denuncias/apoios";
import { ErroDominio } from "../erros";
import type { PrismaClient } from "../../../generated/prisma/client";

/** Tudo o que o Voz DF guarda ligado à pessoa, em formato legível (JSON). Nunca inclui o hash da senha. */
export async function exportarDadosDoTitular(db: PrismaClient, usuarioId: string, agora = new Date()) {
  const u = await db.usuario.findUniqueOrThrow({
    where: { id: usuarioId },
    select: {
      nome: true,
      email: true,
      papel: true,
      criadoEm: true,
      notificarPorEmail: true,
      denuncias: {
        orderBy: { criadoEm: "asc" },
        select: {
          protocolo: true,
          criadoEm: true,
          status: true,
          descricao: true,
          latitude: true,
          longitude: true,
          enderecoReferencia: true,
          categoria: { select: { nome: true } },
          ra: { select: { nome: true } },
          _count: { select: { anexos: true } },
          eventos: { where: { publico: true }, orderBy: { criadoEm: "asc" }, select: { criadoEm: true, statusPara: true, texto: true } },
          avaliacoes: { orderBy: { criadoEm: "asc" }, select: { criadoEm: true, tipo: true, justificativa: true } },
        },
      },
      apoios: { orderBy: { criadoEm: "asc" }, select: { criadoEm: true, denuncia: { select: { protocolo: true } } } },
    },
  });

  return {
    geradoEm: agora.toISOString(),
    conta: { nome: u.nome, email: u.email, papel: u.papel, criadaEm: u.criadoEm.toISOString(), notificarPorEmail: u.notificarPorEmail },
    denuncias: u.denuncias.map((d) => ({
      protocolo: d.protocolo,
      criadaEm: d.criadoEm.toISOString(),
      status: d.status,
      categoria: d.categoria.nome,
      regiaoAdministrativa: d.ra.nome,
      relato: d.descricao,
      local: { latitude: d.latitude, longitude: d.longitude, referencia: d.enderecoReferencia },
      fotos: d._count.anexos,
      historico: d.eventos.map((e) => ({ em: e.criadoEm.toISOString(), status: e.statusPara, mensagem: e.texto })),
      avaliacoesDaResolucao: d.avaliacoes.map((a) => ({ em: a.criadoEm.toISOString(), tipo: a.tipo, justificativa: a.justificativa })),
    })),
    apoios: u.apoios.map((a) => ({ protocolo: a.denuncia.protocolo, em: a.criadoEm.toISOString() })),
  };
}

/**
 * Exclui a conta após confirmar a senha. As denúncias continuam (já foram entregues ao GDF), mas sem
 * vínculo com a pessoa — ficam como anônimas. Apoios e e-mails da fila são apagados; o novo total de
 * apoios é reenviado ao GDF (se falhar, os apoios restantes ficam pendentes e o reenvio corrige).
 */
export async function excluirConta(deps: ApoioDeps, usuarioId: string, senha: string) {
  const usuario = await deps.db.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { email: true } });
  if (!(await verificarCredenciais(deps.db, usuario.email, senha))) {
    throw new ErroDominio("SENHA_INCORRETA", "Senha incorreta.", 403);
  }

  const apoiadas = await deps.db.$transaction(async (tx) => {
    const apoios = await tx.apoio.findMany({ where: { usuarioId }, select: { denunciaId: true } });
    const ids = apoios.map((a) => a.denunciaId);
    // Marca os apoios de outras pessoas nessas denúncias como pendentes: o reenvio informa o total novo.
    await tx.apoio.updateMany({ where: { denunciaId: { in: ids }, usuarioId: { not: usuarioId } }, data: { enviadoEm: null } });
    // Cascata no banco: apoios e notificações somem; denúncias e eventos ficam com autorId nulo.
    await tx.usuario.delete({ where: { id: usuarioId } });
    return ids;
  });

  for (const denunciaId of apoiadas) await enviarApoiosAoGdf(deps, denunciaId).catch(() => {});
  return { denunciasApoiadas: apoiadas.length };
}
