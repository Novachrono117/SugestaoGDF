// Qual RA contém o ponto? { ra: { codigo, nome } | null }. Só sugere: o cidadão pode trocar.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { respostaDeErro } from "@/server/http";
import { detectarRaPorPonto } from "@/server/regioes";

const pontoSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export async function GET(request: NextRequest) {
  try {
    const { lat, lng } = pontoSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json({ ra: await detectarRaPorPonto(db, lat, lng) });
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
