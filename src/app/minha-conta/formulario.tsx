"use client";

import { useActionState } from "react";
import { Alerta, Botao, Campo } from "@/components/ui";
import { excluirContaAcao, salvarPreferenciasAcao } from "./actions";

export function FormExcluirConta() {
  const [estado, acao, ocupado] = useActionState(excluirContaAcao, undefined);
  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      {estado?.erro && <Alerta>{estado.erro}</Alerta>}
      <p className="text-sm text-slate-700">
        Apagamos seu nome, e-mail, senha, apoios e avisos pendentes. Suas denúncias continuam no GDF, mas{" "}
        <strong>sem ligação com você</strong> — você não conseguirá mais vê-las em “Minhas denúncias” (guarde os
        protocolos). Não dá para desfazer.
      </p>
      <Campo id="senha-exclusao" name="senha" label="Sua senha" type="password" autoComplete="current-password" required />
      <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <input type="checkbox" name="confirmo" required className="mt-1 h-5 w-5 shrink-0" />
        <span className="text-sm text-slate-800">Entendo que a exclusão é definitiva.</span>
      </label>
      <Botao type="submit" variante="perigo" disabled={ocupado} className="self-start">
        {ocupado ? "Excluindo…" : "Excluir minha conta"}
      </Botao>
    </form>
  );
}

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
