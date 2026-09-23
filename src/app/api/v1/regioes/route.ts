import { db } from "@/server/db";

export async function GET() {
  const regioes = await db.regiaoAdministrativa.findMany({
    orderBy: { numero: "asc" },
    select: { codigo: true, numero: true, nome: true, slug: true },
  });
  return Response.json(regioes);
}
