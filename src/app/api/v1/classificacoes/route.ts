// Sugestão da IA para o wizard (só sugere; o cidadão confirma e o GDF decide).
import { classificacaoSchema } from "@/lib/validation/denuncia";
import { obterClassificador } from "@/server/container";
import { erroJson, respostaDeErro } from "@/server/http";
import { limites } from "@/server/limites";
import { ipDoCliente } from "@/server/rate-limit";

export async function POST(request: Request) {
  if (!limites.classificacaoPorIp.consumir(ipDoCliente(request.headers)).ok) {
    return erroJson(429, "LIMITE_EXCEDIDO", "Muitas solicitações. Aguarde alguns minutos.");
  }
  try {
    const { descricao } = classificacaoSchema.parse(await request.json());
    return Response.json(await obterClassificador().classificar(descricao));
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
