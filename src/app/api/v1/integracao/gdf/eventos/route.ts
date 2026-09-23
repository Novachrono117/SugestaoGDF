// Callback do GDF: mudanças de status/decisão de órgão e avaliação da IA pelo operador (docs/ARQUITETURA.md §2).
import { entradaCallbackGdfSchema } from "@/lib/validation/integracao-gdf";
import { db } from "@/server/db";
import { serverEnv } from "@/server/env";
import { chaveValida, erroJson, respostaDeErro } from "@/server/http";
import { aplicarAvaliacaoIa } from "@/server/integracao/avaliacao-ia";
import { aplicarEventoGdf } from "@/server/integracao/callback-gdf";

export async function POST(request: Request) {
  if (!chaveValida(request, serverEnv().GDF_CALLBACK_KEY)) {
    return erroJson(401, "NAO_AUTORIZADO", "Chave de integração inválida.");
  }
  try {
    const evento = entradaCallbackGdfSchema.parse(await request.json());
    if (evento.tipo === "AVALIACAO_IA") return Response.json(await aplicarAvaliacaoIa(db, evento));
    const resultado = await aplicarEventoGdf(db, evento);
    return Response.json(resultado, { status: resultado.aplicado ? 200 : 202 });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
