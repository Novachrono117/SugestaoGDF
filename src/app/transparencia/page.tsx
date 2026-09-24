import type { Metadata } from "next";
import { formatarData } from "@/components/status";
import { Cartao } from "@/components/ui";
import type { Indicador } from "@/domain/indicadores";
import { db } from "@/server/db";
import { indicadoresPublicos } from "@/server/relatorios";

export const metadata: Metadata = { title: "Transparência — Voz DF" };
export const dynamic = "force-dynamic"; // números sempre atuais

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const dias = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR")} dia(s)`);

function Tabela({ titulo, itens, rotuloNome }: { titulo: string; itens: Indicador[]; rotuloNome: string }) {
  return (
    <Cartao className="p-0">
      <h2 className="px-5 pt-5 text-lg font-semibold text-slate-900">{titulo}</h2>
      {itens.length === 0 ? (
        <p className="p-5 text-sm text-slate-600">Ainda sem dados.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="px-5 py-2">{rotuloNome}</th>
                <th scope="col" className="px-3 py-2 text-right">Denúncias</th>
                <th scope="col" className="px-3 py-2 text-right">Resolvidas</th>
                <th scope="col" className="px-3 py-2 text-right">% resolvidas</th>
                <th scope="col" className="px-3 py-2 text-right">Tempo médio</th>
                <th scope="col" className="px-5 py-2 text-right">Confirmadas pelo cidadão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itens.map((i) => (
                <tr key={i.nome}>
                  <th scope="row" className="px-5 py-2 font-medium text-slate-900">{i.nome}</th>
                  <td className="px-3 py-2 text-right tabular-nums">{i.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{i.resolvidas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(i.percentualResolvidas)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dias(i.diasMedioResolucao)}</td>
                  <td className="px-5 py-2 text-right tabular-nums">{i.confirmadas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Cartao>
  );
}

export default async function TransparenciaPage() {
  const r = await indicadoresPublicos(db);
  const g = r.geral;
  const destaques = [
    ["Denúncias registradas", String(g.total)],
    ["Resolvidas", `${g.resolvidas} (${pct(g.percentualResolvidas)})`],
    ["Tempo médio até resolver", dias(g.diasMedioResolucao)],
    ["Confirmadas pelo cidadão", `${g.confirmadas} · contestadas: ${g.contestadas}`],
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Transparência</h1>
        <p className="text-sm text-slate-600">
          Números agregados das denúncias, sem nenhum dado pessoal. “% resolvidas” considera só as procedentes (não conta
          não procedentes nem duplicadas). Atualizado em {formatarData(r.geradoEm)}.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumo do Distrito Federal">
        {destaques.map(([rotulo, valor]) => (
          <Cartao key={rotulo} className="p-4">
            <p className="text-sm text-slate-600">{rotulo}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{valor}</p>
          </Cartao>
        ))}
      </section>

      <Tabela titulo="Por Região Administrativa" itens={r.porRa} rotuloNome="RA" />
      <Tabela titulo="Por categoria" itens={r.porCategoria} rotuloNome="Categoria" />
      <Tabela titulo="Por órgão responsável (definido pelo GDF)" itens={r.porOrgao} rotuloNome="Órgão" />

      <p className="text-xs text-slate-500">
        Projeto acadêmico com dados de demonstração. Em uso real, estes números viriam das decisões registradas pelo GDF.
      </p>
    </main>
  );
}
