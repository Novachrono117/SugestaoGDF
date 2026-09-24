"use client";

import { useActionState } from "react";
import { Alerta, Botao } from "@/components/ui";
import { salvarPreferenciasAcao } from "./actions";

export function FormPreferencias({ notificarPorEmail }: { notificarPorEmail: boolean }) {
  const [estado, acao, pendente] = useActionState(salvarPreferenciasAcao, undefined);
  return (
    <form action={acao} className="flex flex-col gap-4">
      {estado?.sucesso && <Alerta tipo="sucesso">{estado.sucesso}</Alerta>}
      {estado?.erro && <Alerta>{estado.erro}</Alerta>}
      <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <input type="checkbox" name="notificarPorEmail" defaultChecked={notificarPorEmail} className="mt-1 h-5 w-5" />
        <span className="text-sm text-slate-800">
          <strong>Receber e-mail a cada atualização</strong> das minhas denúncias (novo status, órgão responsável e
          mensagem do GDF). O e-mail não inclui o texto do seu relato.
        </span>
      </label>
      <Botao type="submit" disabled={pendente} className="self-start">
        {pendente ? "Salvando…" : "Salvar preferências"}
      </Botao>
    </form>
  );
}
