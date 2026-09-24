// SIMULADOR GDF: exportação CSV das manifestações (somente operador; sem o relato do cidadão).
import { usuarioOuErro } from "@/server/auth/sessao";
import { db } from "@/server/db";
import { csvDoSimulador } from "@/server/relatorios";

export async function GET() {
  const { erro } = await usuarioOuErro("OPERADOR_GDF");
  if (erro) return erro;
  const hoje = new Date().toISOString().slice(0, 10);
  return new Response(await csvDoSimulador(db), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="manifestacoes-voz-df-${hoje}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
