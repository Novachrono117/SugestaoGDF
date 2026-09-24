import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SeloStatus, formatarData } from "@/components/status";
import { Alerta, Cartao } from "@/components/ui";
import { normalizarProtocolo } from "@/domain/protocolo";
import { obterUsuarioAtual } from "@/server/auth/sessao";
import { db } from "@/server/db";
import { situacaoApoio } from "@/server/denuncias/apoios";
import { consultarSituacaoAvaliacao, ultimaJustificativa } from "@/server/denuncias/avaliacao-cidadao";
import { consultarPorProtocolo, detalheDoAutor } from "@/server/denuncias/consulta";
import { BotaoApoiar } from "./apoio";
import { CartaoAvaliacao } from "./avaliacao";

export async function generateMetadata({ params }: PageProps<"/acompanhar/[protocolo]">): Promise<Metadata> {
  return { title: `${(await params).protocolo} — Voz DF` };
}

const ATOR: Record<string, string> = { SISTEMA: "Voz DF", GDF: "GDF", CIDADAO: "Cidadão" };


export default async function AcompanharProtocoloPage({ params, searchParams }: PageProps<"/acompanhar/[protocolo]">) {
  const bruto = (await params).protocolo;
  const protocolo = normalizarProtocolo(decodeURIComponent(bruto));
  if (!protocolo) notFound();
  if (protocolo !== bruto) redirect(`/acompanhar/${protocolo}`);

  const [consulta, usuario, { nova, apoio }] = await Promise.all([
    consultarPorProtocolo(db, protocolo),
    obterUsuarioAtual(),
    searchParams,
  ]);
  if (!consulta) notFound();
  // Descrição e fotos só para a pessoa que denunciou (consulta pública não mostra).
  const detalhe = usuario ? await detalheDoAutor(db, protocolo, usuario.id) : null;
  const apoios = await situacaoApoio(db, protocolo, usuario?.id ?? null);
  const [avaliacao, contestacao] =
    detalhe && usuario
      ? await Promise.all([
          consultarSituacaoAvaliacao(db, protocolo, usuario.id),
          ultimaJustificativa(db, protocolo, usuario.id),
        ])
      : [null, null];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-6">
      {nova === "1" && (
        <Alerta tipo="sucesso">
          <strong>Denúncia registrada!</strong> Anote seu protocolo: <strong className="font-mono">{protocolo}</strong>.
          {consulta.status === "RECEBIDA"
            ? " Estamos tentando entregá-la ao GDF; o status muda assim que for recebida."
            : " Ela já foi enviada ao GDF."}
        </Alerta>
      )}

      {apoio === "1" && (
        <Alerta tipo="sucesso">
          <strong>Apoio registrado!</strong> O GDF passa a ver que mais gente tem esse problema.
        </Alerta>
      )}

      <Cartao>
        <p className="text-sm text-slate-600">Protocolo</p>
        <h1 className="font-mono text-2xl font-bold text-slate-900">{protocolo}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SeloStatus status={consulta.status} />
          <span className="text-sm text-slate-600">
            {consulta.categoria.nome} · {consulta.ra.nome}
          </span>
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-600">Registrada em</dt>
            <dd className="font-medium text-slate-900">{formatarData(consulta.criadoEm)}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Órgão responsável (definido pelo GDF)</dt>
            <dd className="font-medium text-slate-900">
              {consulta.orgaoResponsavel ? `${consulta.orgaoResponsavel.nome} (${consulta.orgaoResponsavel.sigla})` : "Aguardando decisão do GDF"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-600">Apoios da comunidade</dt>
            <dd className="font-medium text-slate-900">
              {consulta.totalApoios === 0 ? "Nenhum ainda" : `${consulta.totalApoios} pessoa(s) também têm esse problema`}
              {apoios?.apoiou && " — inclusive você"}
            </dd>
          </div>
          {consulta.orgaoSugeridoIA && (
            <div className="sm:col-span-2">
              <dt className="text-slate-600">Sugestão da IA</dt>
              <dd className="text-slate-800">
                {consulta.orgaoSugeridoIA.nome} ({consulta.orgaoSugeridoIA.sigla})
              </dd>
            </div>
          )}
        </dl>
      </Cartao>

      {apoios?.podeApoiar && <BotaoApoiar protocolo={protocolo} />}
      {!usuario && ["ENVIADA_GDF", "EM_ANALISE", "ENCAMINHADA", "EM_EXECUCAO", "REABERTA"].includes(consulta.status) && (
        <p className="text-sm text-slate-600">
          Tem o mesmo problema?{" "}
          <Link href={`/entrar?voltar=/acompanhar/${protocolo}`} className="font-semibold text-blue-700 underline">
            Entre para apoiar esta denúncia
          </Link>
          .
        </p>
      )}

      {avaliacao?.pode && <CartaoAvaliacao protocolo={protocolo} prazoAte={formatarData(avaliacao.prazoAte)} />}
      {avaliacao && !avaliacao.pode && avaliacao.motivo === "JA_AVALIADA" && (
        <Alerta tipo={avaliacao.avaliacao === "CONFIRMADA" ? "sucesso" : "info"}>
          {avaliacao.avaliacao === "CONFIRMADA"
            ? "Você confirmou que o problema foi resolvido. Obrigado pelo retorno!"
            : "Você informou que o problema continua; a denúncia foi reaberta."}
        </Alerta>
      )}
      {consulta.status === "RESOLVIDA" && !detalhe && (
        <p className="text-sm text-slate-600">
          Quem fez a denúncia com uma conta pode confirmar se o problema foi mesmo resolvido.
        </p>
      )}

      {detalhe && (
        <Cartao>
          <h2 className="mb-2 text-lg font-semibold text-slate-900">Seu relato</h2>
          <p className="whitespace-pre-wrap break-words text-slate-800">{detalhe.descricao}</p>
          {detalhe.enderecoReferencia && <p className="mt-2 text-sm text-slate-600">Referência: {detalhe.enderecoReferencia}</p>}
          {detalhe.anexos.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {detalhe.anexos.map((a, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- servida pela API com token
                <img key={a.token} src={`/api/v1/anexos/${a.token}`} alt={`Foto ${i + 1} da denúncia`} className="h-28 w-28 rounded-lg object-cover" />
              ))}
            </div>
          )}
          {contestacao?.justificativa && (
            <p className="mt-3 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">
              <strong>Sua última contestação ({formatarData(contestacao.criadoEm)}):</strong> {contestacao.justificativa}
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500">Só você vê este texto e as fotos aqui. A consulta pública mostra apenas o andamento.</p>
        </Cartao>
      )}

      <Cartao>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Andamento</h2>
        <ol className="relative flex flex-col gap-4 border-l-2 border-slate-200 pl-5">
          {consulta.historico.map((h, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-blue-700 ring-4 ring-white" aria-hidden />
              <p className="font-medium text-slate-900">{h.statusRotulo}</p>
              {h.texto && <p className="text-sm text-slate-700">{h.texto}</p>}
              <p className="text-xs text-slate-500">
                {formatarData(h.em)} · {ATOR[h.ator] ?? h.ator}
              </p>
            </li>
          ))}
        </ol>
      </Cartao>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/acompanhar" className="font-semibold text-blue-700 underline">
          Consultar outro protocolo
        </Link>
        {usuario && (
          <Link href="/minhas-denuncias" className="font-semibold text-blue-700 underline">
            Minhas denúncias
          </Link>
        )}
      </div>
    </main>
  );
}
