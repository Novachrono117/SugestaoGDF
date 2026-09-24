// Reprocessa envios ao GDF que falharam (somente operador).
import { usuarioOuErro } from "@/server/auth/sessao";
import { depsDenuncia, obterEnviadorEmail } from "@/server/container";
import { db } from "@/server/db";
import { processarEmailsPendentes } from "@/server/email/notificacoes";
import { reenviarPendentes } from "@/server/denuncias/envio-gdf";

export async function POST() {
  const { erro } = await usuarioOuErro("OPERADOR_GDF");
  if (erro) return erro;
  const envios = await reenviarPendentes(depsDenuncia());
  const emails = await processarEmailsPendentes({ db, enviador: obterEnviadorEmail() });
  return Response.json({ ...envios, emails });
}
