// SIMULADOR GDF (demonstração): endpoint que faz o papel do sistema do governo recebendo o push.
import { payloadGdfV1Schema } from "@/lib/validation/integracao-gdf";
import { db } from "@/server/db";
import { serverEnv } from "@/server/env";
import { chaveValida, erroJson, respostaDeErro } from "@/server/http";
import { receberManifestacao } from "@/simulador-gdf/receber";

export async function POST(request: Request) {
  if (!chaveValida(request, serverEnv().GDF_WEBHOOK_KEY)) {
    return erroJson(401, "NAO_AUTORIZADO", "Chave de integração inválida.");
  }
  try {
    const payload = payloadGdfV1Schema.parse(await request.json());
    return Response.json(await receberManifestacao(db, payload), { status: 201 });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
