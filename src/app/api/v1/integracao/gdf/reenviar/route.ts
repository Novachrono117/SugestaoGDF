// Reprocessa o que falhou: envios ao GDF (denúncias, avaliações, apoios) e e-mails da fila.
// Quem pode: operador logado (botão do simulador) ou o agendador, com `Authorization: Bearer <TAREFAS_KEY>`.
import { usuarioOuErro } from "@/server/auth/sessao";
import { depsDenuncia, obterEnviadorEmail } from "@/server/container";
import { db } from "@/server/db";
import { processarEmailsPendentes } from "@/server/email/notificacoes";
import { reenviarPendentes } from "@/server/denuncias/envio-gdf";
import { serverEnv } from "@/server/env";
import { chaveValida, erroJson } from "@/server/http";

export async function POST(request: Request) {
  const chaveTarefas = serverEnv().TAREFAS_KEY;
  if (request.headers.has("authorization")) {
    // Chave errada não cai para a sessão: quem manda chave é máquina, e o erro deve ser explícito.
    if (!chaveTarefas || !chaveValida(request, chaveTarefas)) {
      return erroJson(401, "NAO_AUTORIZADO", "Chave de tarefas inválida.");
    }
  } else {
    const { erro } = await usuarioOuErro("OPERADOR_GDF");
    if (erro) return erro;
  }
  const envios = await reenviarPendentes(depsDenuncia());
  const emails = await processarEmailsPendentes({ db, enviador: obterEnviadorEmail() });
  return Response.json({ ...envios, emails });
}
