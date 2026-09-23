import type { Metadata } from "next";
import { AvisoEmergencia } from "@/components/aviso-emergencia";
import { obterUsuarioAtual } from "@/server/auth/sessao";
import { db } from "@/server/db";
import { AssistenteDenuncia } from "./assistente";

export const metadata: Metadata = { title: "Fazer denúncia — Voz DF" };

export default async function DenunciarPage() {
  const [categorias, regioes, usuario] = await Promise.all([
    db.categoria.findMany({
      where: { ativa: true },
      select: { slug: true, nome: true, descricao: true, orgaoPadrao: { select: { sigla: true, nome: true } } },
    }),
    db.regiaoAdministrativa.findMany({ select: { codigo: true, nome: true } }),
    obterUsuarioAtual(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-slate-900">Fazer denúncia</h1>
      <AvisoEmergencia />
      <AssistenteDenuncia
        categorias={categorias
          .map(({ orgaoPadrao, ...c }) => ({ ...c, orgao: orgaoPadrao }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))}
        // Ordena em JS: o SQLite ordena por byte e jogaria "Águas Claras" para o fim da lista.
        regioes={regioes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))}
        usuario={usuario ? { nome: usuario.nome } : null}
      />
    </main>
  );
}
