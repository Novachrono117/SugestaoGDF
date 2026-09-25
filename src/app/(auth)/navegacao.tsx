"use client";

import { useEffect, useTransition } from "react";
import { apagarRascunho } from "@/lib/rascunho-denuncia";
import { sair } from "./actions";

/**
 * Após login/logout, recarrega a página inteira em vez de navegar pelo roteador do cliente:
 * garante uma requisição nova com o cookie de sessão atualizado e descarta RSC em cache.
 */
export function useNavegacaoCompleta(destino: string | undefined) {
  useEffect(() => {
    if (destino) window.location.assign(destino);
  }, [destino]);
}

export function BotaoSair() {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          await sair();
          // Aparelho pode ser compartilhado: o relato em rascunho não fica para a próxima pessoa.
          apagarRascunho(localStorage);
          // Intencional: navegação completa para descartar o estado de sessão em cache (ver acima).
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/");
        })
      }
      className="font-medium text-slate-700 underline hover:text-blue-700 disabled:opacity-60"
    >
      {pendente ? "Saindo…" : "Sair"}
    </button>
  );
}
