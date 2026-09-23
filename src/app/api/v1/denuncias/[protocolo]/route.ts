// Consulta pública por protocolo (sem dados pessoais, sem descrição).
import type { NextRequest } from "next/server";
import { normalizarProtocolo } from "@/domain/protocolo";
import { db } from "@/server/db";
import { consultarPorProtocolo } from "@/server/denuncias/consulta";
import { erroJson } from "@/server/http";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/v1/denuncias/[protocolo]">) {
  const protocolo = normalizarProtocolo((await ctx.params).protocolo);
  if (!protocolo) return erroJson(400, "PROTOCOLO_INVALIDO", "Formato esperado: DF-AAAA-NNNNNN.");
  const consulta = await consultarPorProtocolo(db, protocolo);
  if (!consulta) return erroJson(404, "PROTOCOLO_NAO_ENCONTRADO", "Protocolo não encontrado.");
  return Response.json(consulta);
}
