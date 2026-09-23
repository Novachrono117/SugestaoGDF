// SIMULADOR GDF (demonstração): recebe o push do Voz DF como faria o sistema do governo.
// Idempotente por protocolo — um reenvio não duplica a manifestação.
import type { PayloadGdfV1 } from "@/lib/validation/integracao-gdf";
import type { PrismaClient } from "../../generated/prisma/client";

export async function receberManifestacao(db: PrismaClient, payload: PayloadGdfV1) {
  const manifestacao = await db.manifestacaoGdf.upsert({
    where: { protocolo: payload.protocolo },
    create: { protocolo: payload.protocolo, payload: JSON.stringify(payload), status: "RECEBIDA" },
    update: {},
    select: { id: true },
  });
  return { idExterno: manifestacao.id };
}
