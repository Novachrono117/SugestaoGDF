// Sugestão da IA para o wizard (só sugere; o cidadão confirma e o GDF decide).
import { classificacaoSchema } from "@/lib/validation/denuncia";
import { obterClassificador } from "@/server/container";
import { respostaDeErro } from "@/server/http";

export async function POST(request: Request) {
  try {
    const { descricao } = classificacaoSchema.parse(await request.json());
    return Response.json(await obterClassificador().classificar(descricao));
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
