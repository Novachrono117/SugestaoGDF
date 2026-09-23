// Pontos públicos do mapa (coordenadas aproximadas, sem dados pessoais). Ver src/server/denuncias/mapa.ts.
import type { NextRequest } from "next/server";
import { db } from "@/server/db";
import { filtrosMapaSchema, pontosPublicos } from "@/server/denuncias/mapa";

export async function GET(request: NextRequest) {
  const filtros = filtrosMapaSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  return Response.json(await pontosPublicos(db, filtros));
}
