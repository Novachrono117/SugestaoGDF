"use client";

import { useActionState, useState } from "react";
import { Alerta, Botao } from "@/components/ui";
import { ROTULO_STATUS, type Status } from "@/domain/status";
import { avaliarIaAcao, decidirAcao, reenviarAcao } from "./actions";

export function FormDecisao({
  protocolo,
  opcoes,
  orgaos,
  orgaoSugerido,
}: {
  protocolo: string;
  opcoes: readonly Status[];
  orgaos: { sigla: string; nome: string }[];
  orgaoSugerido: string;
}) {
  const [estado, acao, pendente] = useActionState(decidirAcao, undefined);
  const [status, setStatus] = useState<Status>(opcoes[0]);
  const exigeOrgao = status === "ENCAMINHADA";
  const exigeTexto = status === "RESOLVIDA" || status === "NAO_PROCEDENTE" || status === "DUPLICADA";

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="protocolo" value={protocolo} />
      {estado?.erro && <Alerta>{estado.erro}</Alerta>}
      {estado?.sucesso && <Alerta tipo="sucesso">{estado.sucesso}</Alerta>}

      <div className="flex flex-col gap-1">
        <label htmlFor="status" className="text-sm font-medium text-slate-800">
          Novo status
        </label>
        <select
          id="status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base"
        >
          {opcoes.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS[s]}
            </option>
          ))}
        </select>
      </div>

      {exigeOrgao && (
        <div className="flex flex-col gap-1">
          <label htmlFor="orgaoSigla" className="text-sm font-medium text-slate-800">
            Órgão responsável (decisão do GDF)
          </label>
          <select
            id="orgaoSigla"
            name="orgaoSigla"
            defaultValue={orgaoSugerido}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base"
          >
            {orgaos.map((o) => (
              <option key={o.sigla} value={o.sigla}>
                {o.sigla} — {o.nome}
                {o.sigla === orgaoSugerido ? " (sugerido pela IA)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="texto" className="text-sm font-medium text-slate-800">
          {exigeTexto ? "Justificativa / providência (obrigatório)" : "Mensagem ao cidadão (opcional)"}
        </label>
        <textarea
          id="texto"
          name="texto"
          rows={3}
          maxLength={2000}
          required={exigeTexto}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
        />
      </div>

      <Botao type="submit" disabled={pendente}>
        {pendente ? "Enviando ao Voz DF…" : "Registrar decisão"}
      </Botao>
    </form>
  );
}

export function BotaoReenviar({ pendentes }: { pendentes: number }) {
  const [estado, acao, pendente] = useActionState(reenviarAcao, undefined);
  return (
    <form action={acao} className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-slate-700">
        Envios pendentes do Voz DF: <strong>{pendentes}</strong>
      </span>
      <Botao type="submit" variante="secundario" disabled={pendente || pendentes === 0}>
        {pendente ? "Reenviando…" : "Reenviar pendentes"}
      </Botao>
      {estado?.sucesso && <span className="text-sm text-emerald-800">{estado.sucesso}</span>}
      {estado?.erro && <span className="text-sm text-red-800">{estado.erro}</span>}
    </form>
  );
}

export function FormAvaliacaoIa({
  protocolo,
  categoriaSugerida,
  categorias,
  atual,
}: {
  protocolo: string;
  categoriaSugerida: string;
  categorias: { slug: string; nome: string }[];
  atual: { acertou: boolean | null; categoriaCorretaSlug: string | null };
}) {
  const [estado, acao, pendente] = useActionState(avaliarIaAcao, undefined);
  const [errou, setErrou] = useState(atual.acertou === false);
  const nomeSugerida = categorias.find((c) => c.slug === categoriaSugerida)?.nome ?? categoriaSugerida;

  return (
    <form action={acao} className="flex flex-col gap-3">
      <input type="hidden" name="protocolo" value={protocolo} />
      <p className="text-sm text-slate-700">
        A IA sugeriu a categoria <strong>{nomeSugerida}</strong>. Ela acertou?
      </p>
      {atual.acertou !== null && (
        <p className="text-xs text-slate-600">
          Avaliação atual: {atual.acertou ? "acertou" : `errou (correta: ${categorias.find((c) => c.slug === atual.categoriaCorretaSlug)?.nome ?? atual.categoriaCorretaSlug})`}
          . Você pode corrigir.
        </p>
      )}
      {estado?.erro && <Alerta>{estado.erro}</Alerta>}
      {estado?.sucesso && <Alerta tipo="sucesso">{estado.sucesso}</Alerta>}

      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">A IA acertou a categoria?</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="acertou" value="sim" defaultChecked={atual.acertou !== false} onChange={() => setErrou(false)} />
          Sim
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="acertou" value="nao" defaultChecked={atual.acertou === false} onChange={() => setErrou(true)} />
          Não
        </label>
      </fieldset>

      {errou && (
        <div className="flex flex-col gap-1">
          <label htmlFor="categoriaCorretaSlug" className="text-sm font-medium text-slate-800">
            Categoria correta
          </label>
          <select
            id="categoriaCorretaSlug"
            name="categoriaCorretaSlug"
            required
            defaultValue={atual.categoriaCorretaSlug ?? ""}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base"
          >
            <option value="">Selecione…</option>
            {categorias
              .filter((c) => c.slug !== categoriaSugerida)
              .map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nome}
                </option>
              ))}
          </select>
        </div>
      )}

      <Botao type="submit" variante="secundario" disabled={pendente}>
        {pendente ? "Enviando…" : "Registrar avaliação da IA"}
      </Botao>
      <p className="text-xs text-slate-500">
        Isto não treina o modelo sozinho: serve para medir a acurácia real e orientar melhorias.
      </p>
    </form>
  );
}
