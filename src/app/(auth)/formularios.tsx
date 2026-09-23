"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alerta, Botao, Campo } from "@/components/ui";
import { cadastrar, entrar } from "./actions";

export function FormEntrar({ voltar }: { voltar: string }) {
  const [estado, acao, pendente] = useActionState(entrar, undefined);
  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="voltar" value={voltar} />
      {estado?.erro && <Alerta>{estado.erro}</Alerta>}
      <Campo id="email" label="E-mail" type="email" autoComplete="email" required defaultValue={estado?.campos?.email} />
      <Campo id="senha" label="Senha" type="password" autoComplete="current-password" required />
      <Botao type="submit" disabled={pendente}>
        {pendente ? "Entrando…" : "Entrar"}
      </Botao>
      <p className="text-center text-sm text-slate-600">
        Não tem conta?{" "}
        <Link href={`/cadastro?voltar=${encodeURIComponent(voltar)}`} className="font-semibold text-blue-700 underline">
          Cadastre-se
        </Link>
      </p>
    </form>
  );
}

export function FormCadastro({ voltar }: { voltar: string }) {
  const [estado, acao, pendente] = useActionState(cadastrar, undefined);
  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="voltar" value={voltar} />
      {estado?.erro && <Alerta>{estado.erro}</Alerta>}
      <Campo id="nome" label="Nome" autoComplete="name" required defaultValue={estado?.campos?.nome} />
      <Campo id="email" label="E-mail" type="email" autoComplete="email" required defaultValue={estado?.campos?.email} />
      <Campo
        id="senha"
        label="Senha"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        dica="Mínimo de 8 caracteres."
      />
      <Botao type="submit" disabled={pendente}>
        {pendente ? "Criando conta…" : "Criar conta"}
      </Botao>
      <p className="text-center text-sm text-slate-600">
        Já tem conta?{" "}
        <Link href={`/entrar?voltar=${encodeURIComponent(voltar)}`} className="font-semibold text-blue-700 underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
