// Aplica a avaliação do operador do GDF sobre a categoria sugerida pela IA.
// Não "treina" o modelo: registra rótulos reais para medir a acurácia e orientar melhorias
// (prompt, modelo, categorias; na fase 2, exemplos corrigidos no prompt).
import type { AvaliacaoIaGdf } from "@/lib/validation/integracao-gdf";
import type { PrismaClient } from "../../../generated/prisma/client";
import { ErroDominio } from "../erros";

export async function aplicarAvaliacaoIa(db: PrismaClient, evento: AvaliacaoIaGdf) {
  const denuncia = await db.denuncia.findUnique({
    where: { protocolo: evento.protocolo },
    select: { sugestao: { select: { id: true, categoriaId: true } } },
  });
  if (!denuncia?.sugestao) throw new ErroDominio("PROTOCOLO_NAO_ENCONTRADO", "Protocolo não encontrado.", 404);

  let categoriaCorretaId: string | null = null;
  if (!evento.acertou) {
    const c = await db.categoria.findUnique({ where: { slug: evento.categoriaCorretaSlug! }, select: { id: true } });
    if (!c) throw new ErroDominio("CATEGORIA_INVALIDA", "Categoria correta inexistente.", 422);
    if (c.id === denuncia.sugestao.categoriaId) {
      throw new ErroDominio("AVALIACAO_INCOERENTE", "A categoria correta é a mesma sugerida — então a IA acertou.", 422);
    }
    categoriaCorretaId = c.id;
  }

  // Sobrescreve: o operador pode corrigir a própria avaliação (idempotente por natureza).
  await db.sugestaoIA.update({
    where: { id: denuncia.sugestao.id },
    data: { acertouSegundoGdf: evento.acertou, categoriaCorretaId, avaliadoPeloGdfEm: new Date(evento.ocorridoEm) },
  });
  return { aplicado: true as const };
}
