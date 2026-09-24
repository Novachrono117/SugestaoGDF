// Possíveis duplicatas: denúncias em andamento da mesma categoria perto do ponto (sem relato).
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { denunciasProximas } from "@/server/denuncias/apoios";
import { respostaDeErro } from "@/server/http";

const filtrosSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  categoria: z.string().min(1).max(60),
});

export async function GET(request: NextRequest) {
  try {
    const f = filtrosSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await denunciasProximas(db, { lat: f.lat, lng: f.lng, categoriaSlug: f.categoria }));
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
