"use client";

import { useActionState, useState } from "react";
import { Alerta, Botao } from "@/components/ui";
import { avaliarResolucaoAcao } from "./actions";

export function CartaoAvaliacao({ protocolo, prazoAte }: { protocolo: string; prazoAte: string }) {
  const [estado, acao, pendente] = useActionState(avaliarResolucaoAcao, undefined);
  const [contestando, setContestando] = useState(Boolean(estado?.justificativa));

  return (
    <section className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5" aria-labelledby="titulo-avaliacao">
      <h2 id="titulo-avaliacao" className="text-lg font-semibold text-slate-900">
        O GDF informou que o problema foi resolvido. Foi mesmo?
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        Sua resposta volta para o GDF. Você pode responder até {prazoAte}.
      </p>
      {estado?.erro && (
        <div className="mt-3">
          <Alerta>{estado.erro}</Alerta>
        </div>
      )}

      {!contestando ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <form action={acao}>
            <input type="hidden" name="protocolo" value={protocolo} />
            <input type="hidden" name="resolvido" value="sim" />
            <Botao type="submit" disabled={pendente} className="w-full bg-emerald-700 hover:bg-emerald-800 sm:w-auto">
              {pendente ? "Enviando…" : "Sim, foi resolvido"}
            </Botao>
          </form>
          <Botao type="button" variante="secundario" onClick={() => setContestando(true)} disabled={pendente}>
            Não, o problema continua
          </Botao>
        </div>
      ) : (
        <form action={acao} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="protocolo" value={protocolo} />
          <input type="hidden" name="resolvido" value="nao" />
          <label htmlFor="justificativa" className="text-sm font-medium text-slate-900">
            Conte o que ainda não foi resolvido (obrigatório)
          </label>
          <textarea
            id="justificativa"
            name="justificativa"
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            defaultValue={estado?.justificativa}
            placeholder="Ex.: O poste acendeu por um dia e apagou de novo."
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
          />
          <p className="text-xs text-slate-600">A denúncia será reaberta e voltará para o GDF analisar de novo.</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Botao type="button" variante="secundario" onClick={() => setContestando(false)} disabled={pendente}>
              Voltar
            </Botao>
            <Botao type="submit" disabled={pendente}>
              {pendente ? "Enviando…" : "Reabrir denúncia"}
            </Botao>
          </div>
        </form>
      )}
    </section>
  );
}
