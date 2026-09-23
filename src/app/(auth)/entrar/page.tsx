import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alerta, Cartao } from "@/components/ui";
import { destinoSeguro } from "@/lib/destino-seguro";
import { obterUsuarioAtual } from "@/server/auth/sessao";
import { FormEntrar } from "../formularios";

export const metadata: Metadata = { title: "Entrar — Voz DF" };

export default async function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  const { voltar } = await searchParams;
  const destino = destinoSeguro(voltar);
  if (await obterUsuarioAtual()) redirect(destino);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-4 sm:p-6">
      <Cartao>
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Entrar</h1>
        <p className="mb-6 text-sm text-slate-600">Acompanhe suas denúncias em um só lugar.</p>
        <FormEntrar voltar={destino} />
      </Cartao>
      <Alerta tipo="info">Não quer se identificar? Você pode fazer uma denúncia anônima sem criar conta.</Alerta>
    </main>
  );
}
