import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cartao } from "@/components/ui";
import { destinoSeguro } from "@/lib/destino-seguro";
import { obterUsuarioAtual } from "@/server/auth/sessao";
import { FormCadastro } from "../formularios";

export const metadata: Metadata = { title: "Criar conta — Voz DF" };

export default async function CadastroPage({ searchParams }: PageProps<"/cadastro">) {
  const { voltar } = await searchParams;
  const destino = destinoSeguro(voltar);
  if (await obterUsuarioAtual()) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4 sm:p-6">
      <Cartao>
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Criar conta</h1>
        <p className="mb-6 text-sm text-slate-600">
          Pedimos só o necessário. Seu nome e e-mail <strong>não</strong> aparecem no mapa público nem são enviados ao
          GDF.
        </p>
        <FormCadastro voltar={destino} />
      </Cartao>
    </main>
  );
}
