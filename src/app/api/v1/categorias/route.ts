import { db } from "@/server/db";

export async function GET() {
  const categorias = await db.categoria.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
    select: { slug: true, nome: true, descricao: true, orgaoPadrao: { select: { sigla: true, nome: true } } },
  });
  return Response.json(categorias);
}
