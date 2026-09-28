import type { Metadata } from "next";
import Link from "next/link";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/server/auth/sessao";
import { db } from "@/server/db";
import { FormExcluirConta, FormPreferencias } from "./formulario";

export const metadata: Metadata = { title: "Minha conta — Voz DF" };

export default async function MinhaContaPage() {
  const usuario = await exigirUsuario(undefined, "/minha-conta");
  const { notificarPorEmail } = await db.usuario.findUniqueOrThrow({
    where: { id: usuario.id },
    select: { notificarPorEmail: true },
  });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900">Minha conta</h1>
      <Cartao>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-slate-600">Nome</dt>
            <dd className="font-medium text-slate-900">{usuario.nome}</dd>
          </div>
          <div>
            <dt className="text-slate-600">E-mail</dt>
            <dd className="font-medium text-slate-900">{usuario.email}</dd>
          </div>
        </dl>
      </Cartao>
      <Cartao>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Notificações</h2>
        <FormPreferencias notificarPorEmail={notificarPorEmail} />
      </Cartao>
      <Cartao>
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Seus dados</h2>
        <p className="mb-3 text-sm text-slate-600">
          Tudo o que guardamos ligado à sua conta: dados da conta, denúncias (com o relato) e apoios. Veja o{" "}
          <Link href="/privacidade" className="font-semibold text-blue-700 underline">
            aviso de privacidade
          </Link>
          .
        </p>
        {/* <a> e não <Link>: é um download, não uma navegação */}
        <a
          href="/api/v1/minha-conta/dados"
          download
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Baixar meus dados (JSON)
        </a>
      </Cartao>
      <Cartao>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Excluir conta</h2>
        <FormExcluirConta />
      </Cartao>
    </main>
  );
}
