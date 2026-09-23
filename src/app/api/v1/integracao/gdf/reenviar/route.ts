// Reprocessa envios ao GDF que falharam (somente operador).
import { usuarioOuErro } from "@/server/auth/sessao";
import { depsDenuncia } from "@/server/container";
import { reenviarPendentes } from "@/server/denuncias/envio-gdf";

export async function POST() {
  const { erro } = await usuarioOuErro("OPERADOR_GDF");
  if (erro) return erro;
  return Response.json(await reenviarPendentes(depsDenuncia()));
}
