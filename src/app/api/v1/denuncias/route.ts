// Criação de denúncia via API (JSON). Autor: anônimo até a autenticação (passo 6).
import { novaDenunciaSchema } from "@/lib/validation/denuncia";
import { depsDenuncia } from "@/server/container";
import { criarDenuncia } from "@/server/denuncias/criar";
import { respostaDeErro } from "@/server/http";

export async function POST(request: Request) {
  try {
    const input = novaDenunciaSchema.parse(await request.json());
    const criada = await criarDenuncia(depsDenuncia(), input, null);
    return Response.json(criada, { status: 201 });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
