import type { Metadata } from "next";
import Link from "next/link";
import { COR_STATUS } from "@/components/cores-status";
import { ROTULO_STATUS, type Status } from "@/domain/status";
import { db } from "@/server/db";
import { filtrosMapaSchema, pontosPublicos } from "@/server/denuncias/mapa";
import { MapaCliente } from "./mapa-cliente";

export const metadata: Metadata = { title: "Mapa das denúncias — Voz DF" };

const LEGENDA: Status[] = ["ENVIADA_GDF", "EM_ANALISE", "ENCAMINHADA", "EM_EXECUCAO", "REABERTA", "RESOLVIDA"];

const estiloSelect =
  "min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30";

export default async function MapaPage({ searchParams }: PageProps<"/mapa">) {
  const filtros = filtrosMapaSchema.parse(await searchParams);
  const [pontos, regioes, categorias] = await Promise.all([
    pontosPublicos(db, filtros),
    db.regiaoAdministrativa.findMany({ select: { codigo: true, nome: true } }),
    db.categoria.findMany({ where: { ativa: true }, select: { slug: true, nome: true } }),
  ]);
  const porNome = (a: { nome: string }, b: { nome: string }) => a.nome.localeCompare(b.nome, "pt-BR");
  regioes.sort(porNome);
  categorias.sort(porNome);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mapa das denúncias</h1>
        <p className="text-sm text-slate-600">
          Localização <strong>aproximada</strong> (cerca de 100 m) e sem dados pessoais. Toque num ponto para ver o
          andamento.
        </p>
      </div>

      {/* GET simples: filtra mesmo sem JavaScript. */}
      <form method="get" className="grid gap-3 sm:grid-cols-4" aria-label="Filtros do mapa">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
          Região
          <select name="ra" defaultValue={filtros.ra ?? ""} className={estiloSelect}>
            <option value="">Todas</option>
            {regioes.map((r) => (
              <option key={r.codigo} value={r.codigo}>
                {r.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
          Categoria
          <select name="categoria" defaultValue={filtros.categoria ?? ""} className={estiloSelect}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
          Situação
          <select name="situacao" defaultValue={filtros.situacao} className={estiloSelect}>
            <option value="todas">Todas</option>
            <option value="abertas">Em andamento</option>
            <option value="resolvidas">Resolvidas</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="min-h-11 flex-1 rounded-lg bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800">
            Filtrar
          </button>
          <Link
            href="/mapa"
            className="flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"
          >
            Limpar
          </Link>
        </div>
      </form>

      <p className="text-sm text-slate-700" aria-live="polite">
        {pontos.length === 0 ? "Nenhuma denúncia com esses filtros." : `${pontos.length} denúncia(s) no mapa.`}
      </p>

      <MapaCliente pontos={pontos} />

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-700" aria-label="Legenda">
        {LEGENDA.map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full ring-2 ring-white" style={{ backgroundColor: COR_STATUS[status] }} aria-hidden />
            {ROTULO_STATUS[status]}
          </li>
        ))}
      </ul>
    </main>
  );
}
