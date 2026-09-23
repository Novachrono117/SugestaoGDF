// SIMULADOR GDF (demonstração): recebe a confirmação/contestação da resolução pelo cidadão.
import type { NextRequest } from "next/server";
import { avaliacaoCidadaoGdfSchema } from "@/lib/validation/integracao-gdf";
import { db } from "@/server/db";
import { serverEnv } from "@/server/env";
import { chaveValida, erroJson, respostaDeErro } from "@/server/http";
import { receberAvaliacaoCidadao } from "@/simulador-gdf/receber";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/simulador-gdf/manifestacoes/[protocolo]/avaliacoes-cidadao">,
) {
  if (!chaveValida(request, serverEnv().GDF_WEBHOOK_KEY)) {
    return erroJson(401, "NAO_AUTORIZADO", "Chave de integração inválida.");
  }
  try {
    const avaliacao = avaliacaoCidadaoGdfSchema.parse(await request.json());
    if (avaliacao.protocolo !== (await ctx.params).protocolo) {
      return erroJson(422, "PROTOCOLO_DIVERGENTE", "Protocolo da URL difere do corpo.");
    }
    const r = await receberAvaliacaoCidadao(db, avaliacao);
    return r ? Response.json(r) : erroJson(404, "NAO_ENCONTRADA", "Manifestação não encontrada.");
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
