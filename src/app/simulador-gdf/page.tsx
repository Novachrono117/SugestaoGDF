import type { Metadata } from "next";
import Link from "next/link";
import { formatarData } from "@/components/status";
import { Alerta, Cartao } from "@/components/ui";
import { exigirUsuario } from "@/server/auth/sessao";
import { db } from "@/server/db";
import { listarManifestacoes, resumo, rotuloSimulador } from "@/simulador-gdf/servico";
import { BotaoReenviar } from "./componentes";

export const metadata: Metadata = { title: "Simulador GDF — Voz DF" };

const FILTROS = [
  ["", "Todas"],
  ["RECEBIDA", "Novas"],
  ["EM_ANALISE", "Em análise"],
  ["ENCAMINHADA", "Encaminhadas"],
  ["EM_EXECUCAO", "Em execução"],
  ["RESOLVIDA", "Resolvidas"],
  ["REABERTA", "Reabertas"],
] as const;

function Contagem({ titulo, itens }: { titulo: string; itens: [string, number][] }) {
  return (
    <Cartao className="p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{titulo}</h2>
      {itens.length === 0 ? (
        <p className="text-sm text-slate-500">—</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {itens.slice(0, 6).map(([nome, n]) => (
            <li key={nome} className="flex justify-between gap-2">
              <span className="truncate text-slate-800">{nome}</span>
              <span className="font-semibold tabular-nums text-slate-900">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

export default async function SimuladorPage({ searchParams }: PageProps<"/simulador-gdf">) {
  await exigirUsuario("OPERADOR_GDF", "/simulador-gdf");
  const { status } = await searchParams;
  const filtro = typeof status === "string" && FILTROS.some(([v]) => v === status) ? status : "";

  const [lista, r, denunciasPendentes, avaliacoesPendentes] = await Promise.all([
    listarManifestacoes(db, filtro || undefined),
    resumo(db),
    db.envioGdf.count({ where: { enviadoEm: null } }),
    db.avaliacaoCidadao.count({ where: { enviadoEm: null } }),
  ]);
  const pendentes = denunciasPendentes + avaliacoesPendentes;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Simulador GDF</h1>
        <p className="text-sm text-slate-600">Faz o papel do sistema do governo que recebe o JSON do Voz DF.</p>
      </div>
      <Alerta tipo="info">
        <strong>Somente demonstração.</strong> Numa integração real, estas decisões aconteceriam no sistema do GDF
        (ex.: Fala.BR/Ouvidoria) e chegariam ao Voz DF pelo mesmo callback.
      </Alerta>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores">
        <Cartao className="p-4">
          <h2 className="text-sm font-semibold text-slate-700">Recebidas</h2>
          <p className="text-3xl font-bold tabular-nums text-slate-900">{r.total}</p>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-600">
            <li>
              Acerto da IA (avaliado pelo GDF): <strong>{r.acuraciaIA.acertos}/{r.acuraciaIA.avaliadas}</strong>
            </li>
            <li>
              Órgão sugerido mantido: {r.concordanciaIA.iguais}/{r.concordanciaIA.decididas}
            </li>
            <li>
              Cidadão: {r.retornoCidadao.confirmadas} confirmada(s), {r.retornoCidadao.contestadas} contestada(s)
            </li>
          </ul>
        </Cartao>
        <Contagem titulo="Por status" itens={r.porStatus} />
        <Contagem titulo="Por RA" itens={r.porRa} />
        <Contagem titulo="Por categoria" itens={r.porCategoria} />
      </section>

      <BotaoReenviar pendentes={pendentes} />

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar por status">
        {FILTROS.map(([valor, rotulo]) => (
          <Link
            key={valor}
            href={valor ? `/simulador-gdf?status=${valor}` : "/simulador-gdf"}
            aria-current={filtro === valor ? "page" : undefined}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 aria-[current=page]:border-blue-700 aria-[current=page]:bg-blue-700 aria-[current=page]:text-white"
          >
            {rotulo}
          </Link>
        ))}
      </nav>

      {lista.length === 0 ? (
        <Cartao>
          <p className="text-slate-700">Nenhuma manifestação {filtro ? "com este status" : "recebida ainda"}.</p>
        </Cartao>
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((m) => {
            const s = m.payload.sugestaoIA;
            return (
              <li key={m.protocolo}>
                <Link
                  href={`/simulador-gdf/${m.protocolo}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-900">{m.protocolo}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.status === "REABERTA" ? "bg-orange-100 text-orange-900" : "bg-slate-100 text-slate-800"}`}
                    >
                      {rotuloSimulador(m.status)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-slate-800">{m.payload.descricao}</p>
                  <p className="mt-2 text-xs text-slate-600">
                    {m.payload.categoria.nome} · {m.payload.local.ra.nome} · {formatarData(m.recebidoEm)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {m.totalApoios > 0 && <strong className="text-amber-800">👍 {m.totalApoios} apoio(s) · </strong>}
                    IA sugere <strong>{s.orgao.sigla}</strong>
                    {m.iaAcertou !== null && (m.iaAcertou ? " ✓ acertou" : " ✗ errou")}
                    {!s.cidadaoConfirmou && " · cidadão trocou a categoria sugerida"}
                    {m.orgaoDecididoSigla && (
                      <>
                        {" "}
                        · GDF decidiu <strong>{m.orgaoDecididoSigla}</strong>
                      </>
                    )}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
