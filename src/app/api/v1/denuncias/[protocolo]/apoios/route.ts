// "Também tenho esse problema": apoia uma denúncia em andamento (exige login; 1 por pessoa).
import type { NextRequest } from "next/server";
import { normalizarProtocolo } from "@/domain/protocolo";
import { usuarioOuErro } from "@/server/auth/sessao";
import { depsDenuncia } from "@/server/container";
import { apoiar } from "@/server/denuncias/apoios";
import { erroJson, respostaDeErro } from "@/server/http";
import { limites } from "@/server/limites";

export async function POST(_request: NextRequest, ctx: RouteContext<"/api/v1/denuncias/[protocolo]/apoios">) {
  const { usuario, erro } = await usuarioOuErro();
  if (erro) return erro;
  const protocolo = normalizarProtocolo((await ctx.params).protocolo);
  if (!protocolo) return erroJson(400, "PROTOCOLO_INVALIDO", "Formato esperado: DF-AAAA-NNNNNN.");
  if (!limites.apoioPorUsuario.consumir(usuario.id).ok) {
    return erroJson(429, "LIMITE_EXCEDIDO", "Muitos apoios em pouco tempo. Tente mais tarde.");
  }
  try {
    const { db, gateway } = depsDenuncia();
    return Response.json(await apoiar({ db, gateway }, protocolo, usuario.id), { status: 201 });
  } catch (e) {
    return respostaDeErro(e);
  }
}
