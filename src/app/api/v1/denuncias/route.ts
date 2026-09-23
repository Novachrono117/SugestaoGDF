// Criação de denúncia via API (JSON). Login opcional; `anonima: true` não vincula o autor.
import { z } from "zod";
import { novaDenunciaSchema } from "@/lib/validation/denuncia";
import { obterUsuarioAtual } from "@/server/auth/sessao";
import { depsDenuncia } from "@/server/container";
import { criarDenuncia } from "@/server/denuncias/criar";
import { erroJson, respostaDeErro } from "@/server/http";
import { limites } from "@/server/limites";
import { ipDoCliente } from "@/server/rate-limit";

const corpoSchema = novaDenunciaSchema.extend({ anonima: z.boolean().default(false) });

export async function POST(request: Request) {
  try {
    const { anonima, ...input } = corpoSchema.parse(await request.json());
    const usuario = anonima ? null : await obterUsuarioAtual();
    if (!limites.denunciaPorOrigem.consumir(usuario?.id ?? ipDoCliente(request.headers)).ok) {
      return erroJson(429, "LIMITE_EXCEDIDO", "Muitas denúncias em pouco tempo. Tente mais tarde.");
    }
    const criada = await criarDenuncia(depsDenuncia(), input, usuario?.id ?? null);
    return Response.json(criada, { status: 201 });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
