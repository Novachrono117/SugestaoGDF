import type { Metadata } from "next";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/server/auth/sessao";
import { db } from "@/server/db";
import { FormPreferencias } from "./formulario";

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
    </main>
  );
}
