import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatarData } from "@/components/status";
import { Alerta, Cartao } from "@/components/ui";
import { exigirUsuario } from "@/server/auth/sessao";
import { db } from "@/server/db";
import { obterManifestacao, opcoesDeStatus, rotuloSimulador } from "@/simulador-gdf/servico";
import { FormAvaliacaoIa, FormDecisao } from "../componentes";

export async function generateMetadata({ params }: PageProps<"/simulador-gdf/[protocolo]">): Promise<Metadata> {
  return { title: `${(await params).protocolo} — Simulador GDF` };
}

export default async function ManifestacaoPage({ params }: PageProps<"/simulador-gdf/[protocolo]">) {
  const { protocolo } = await params;
  await exigirUsuario("OPERADOR_GDF", `/simulador-gdf/${protocolo}`);

  const [m, orgaos, categorias] = await Promise.all([
    obterManifestacao(db, protocolo),
    db.orgao.findMany({ select: { sigla: true, nome: true }, orderBy: { sigla: "asc" } }),
    db.categoria.findMany({ where: { ativa: true }, select: { slug: true, nome: true } }),
  ]);
  categorias.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (!m) notFound();

  const p = m.payload;
  const s = p.sugestaoIA;
  const opcoes = opcoesDeStatus(m.status);
  const mapa = `https://www.openstreetmap.org/?mlat=${p.local.latitude}&mlon=${p.local.longitude}#map=18/${p.local.latitude}/${p.local.longitude}`;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <Link href="/simulador-gdf" className="text-sm font-semibold text-blue-700 underline">
        ← Voltar à fila
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-2xl font-bold text-slate-900">{p.protocolo}</h1>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">
          {rotuloSimulador(m.status)}
        </span>
      </div>

      {m.avaliacaoCidadao === "CONTESTADA" && (
        <Alerta>
          <strong>O cidadão reabriu esta denúncia:</strong> “{m.justificativaCidadao}”
        </Alerta>
      )}
      {m.avaliacaoCidadao === "CONFIRMADA" && (
        <Alerta tipo="sucesso">O cidadão confirmou que o problema foi resolvido.</Alerta>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Cartao>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Relato do cidadão</h2>
            <p className="whitespace-pre-wrap break-words text-slate-800">{p.descricao}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-600">Categoria (confirmada pelo cidadão)</dt>
                <dd className="font-medium text-slate-900">{p.categoria.nome}</dd>
              </div>
              <div>
                <dt className="text-slate-600">Região Administrativa</dt>
                <dd className="font-medium text-slate-900">
                  {p.local.ra.nome} ({p.local.ra.codigo})
                </dd>
              </div>
              <div>
                <dt className="text-slate-600">Local</dt>
                <dd className="text-slate-900">
                  <a href={mapa} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                    {p.local.latitude.toFixed(5)}, {p.local.longitude.toFixed(5)}
                  </a>
                  {p.local.enderecoReferencia && <span className="block text-slate-700">{p.local.enderecoReferencia}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600">Recebida em</dt>
                <dd className="text-slate-900">{formatarData(m.recebidoEm)}</dd>
              </div>
              <div>
                <dt className="text-slate-600">Apoios da comunidade</dt>
                <dd className="font-medium text-slate-900">
                  {m.totalApoios === 0 ? "Nenhum" : `👍 ${m.totalApoios} pessoa(s) relataram o mesmo problema`}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600">Identificação</dt>
                <dd className="text-slate-900">
                  {p.anonima ? "Anônima" : "Cidadão identificado no Voz DF"} — nenhum dado pessoal recebido
                </dd>
              </div>
            </dl>
            {p.anexos.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {p.anexos.map((a, i) => (
                  <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL externa enviada no payload */}
                    <img src={a.url} alt={`Foto ${i + 1}`} className="h-28 w-28 rounded-lg object-cover" />
                  </a>
                ))}
              </div>
            )}
          </Cartao>

          <details className="rounded-2xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer font-semibold text-slate-900">JSON recebido pela API</summary>
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
              {JSON.stringify(p, null, 2)}
            </pre>
          </details>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Cartao className="border-blue-200 bg-blue-50">
            <h2 className="text-sm font-semibold text-blue-900">Sugestão da IA</h2>
            <p className="mt-2 text-lg font-bold text-slate-900">{s.orgao.nome}</p>
            <p className="text-sm text-slate-700">{s.orgao.sigla}</p>
            <p className="mt-3 text-sm italic text-slate-700">“{s.justificativa}”</p>
            <p className="mt-3 text-xs text-slate-600">
              {s.origem === "LLM" ? `LLM local (${s.modelo})` : "Regras por palavra-chave (fallback)"}
              {!s.cidadaoConfirmou && " · o cidadão trocou a categoria sugerida"}
            </p>
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">A IA acertou?</h2>
            <FormAvaliacaoIa
              protocolo={p.protocolo}
              categoriaSugerida={s.categoriaSlug}
              categorias={categorias}
              atual={{ acertou: m.iaAcertou, categoriaCorretaSlug: m.categoriaCorretaSlug }}
            />
          </Cartao>

          <Cartao>
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Decisão do GDF</h2>
            {m.orgaoDecididoSigla && (
              <p className="mb-3 text-sm text-slate-700">
                Órgão definido: <strong>{m.orgaoDecididoSigla}</strong>
              </p>
            )}
            {opcoes.length === 0 ? (
              <Alerta tipo="info">Manifestação encerrada ({rotuloSimulador(m.status)}).</Alerta>
            ) : (
              <FormDecisao
                protocolo={p.protocolo}
                opcoes={opcoes}
                orgaos={orgaos}
                orgaoSugerido={s.orgao.sigla}
              />
            )}
          </Cartao>
        </div>
      </div>
    </main>
  );
}
