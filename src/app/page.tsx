import Link from "next/link";
import { ApagarRascunho } from "@/components/apagar-rascunho";
import { AvisoEmergencia } from "@/components/aviso-emergencia";
import { BuscaProtocolo } from "@/components/busca-protocolo";
import { Alerta } from "@/components/ui";

const PASSOS = [
  ["Conte o que está acontecendo", "Com suas palavras, com foto se quiser. Não precisa saber qual órgão é o responsável."],
  ["A IA sugere a categoria", "Você confirma ou troca com um toque. Depois marca o local no mapa."],
  ["O GDF recebe e decide", "Sua denúncia chega ao governo organizada, sem seus dados pessoais. Você acompanha pelo protocolo."],
] as const;

export default async function Home({ searchParams }: PageProps<"/">) {
  const { erro, conta } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-4 sm:p-6">
      {erro === "acesso-negado" && <Alerta>Você não tem permissão para acessar aquela página.</Alerta>}
      {conta === "excluida" && (
        <>
          <ApagarRascunho />
          <Alerta tipo="sucesso">Sua conta foi excluída. Suas denúncias seguem no GDF, sem ligação com você.</Alerta>
        </>
      )}

      <section className="flex flex-col gap-4 pt-4">
        <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
          Viu um problema na sua rua? <span className="text-blue-700">Conte pra gente.</span>
        </h1>
        <p className="text-lg text-slate-700">
          Buraco, poste apagado, lixo acumulado, esgoto… Registre em poucos minutos e acompanhe até a solução.
        </p>
        <Link
          href="/denunciar"
          className="inline-flex min-h-12 items-center justify-center self-start rounded-xl bg-blue-700 px-6 text-lg font-semibold text-white shadow hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Fazer denúncia
        </Link>
        <AvisoEmergencia />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="titulo-acompanhar">
        <h2 id="titulo-acompanhar" className="mb-3 text-lg font-semibold text-slate-900">
          Já fez uma denúncia? Acompanhe pelo protocolo
        </h2>
        <BuscaProtocolo />
      </section>

      <Link
        href="/mapa"
        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-400"
      >
        <span>
          <span className="block text-lg font-semibold text-slate-900">Mapa das denúncias</span>
          <span className="block text-sm text-slate-600">Veja o que já foi registrado na sua região e o andamento.</span>
        </span>
        <span aria-hidden className="text-2xl text-blue-700">
          →
        </span>
      </Link>

      <section aria-labelledby="titulo-como">
        <h2 id="titulo-como" className="mb-4 text-lg font-semibold text-slate-900">
          Como funciona
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {PASSOS.map(([titulo, texto], i) => (
            <li key={titulo} className="rounded-2xl border border-slate-200 bg-white p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-800">
                {i + 1}
              </span>
              <p className="mt-3 font-semibold text-slate-900">{titulo}</p>
              <p className="mt-1 text-sm text-slate-600">{texto}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
