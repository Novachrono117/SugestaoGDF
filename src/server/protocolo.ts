// Geração do protocolo: incrementa o contador do ano na MESMA transação que cria a denúncia.
// upsert com increment vira um único UPDATE/INSERT atômico — sem count() + 1, que duplica em concorrência.
import { formatarProtocolo } from "@/domain/protocolo";
import type { Prisma } from "../../generated/prisma/client";

// Ano no fuso do DF: num servidor em UTC, 31/12 às 22h em Brasília já seria o ano seguinte.
const anoBrasilia = new Intl.DateTimeFormat("en", { timeZone: "America/Sao_Paulo", year: "numeric" });

export async function gerarProtocolo(tx: Prisma.TransactionClient, agora: Date): Promise<string> {
  const ano = Number(anoBrasilia.format(agora));
  const { ultimo } = await tx.contadorProtocolo.upsert({
    where: { ano },
    create: { ano, ultimo: 1 },
    update: { ultimo: { increment: 1 } },
  });
  return formatarProtocolo(ano, ultimo);
}
