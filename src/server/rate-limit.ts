// Rate limit em memória (janela fixa). Suficiente para o MVP com um único processo;
// com várias instâncias (fase 2) trocar por um store compartilhado (ex.: Redis/Postgres).

export type RateLimiter = {
  consumir(chave: string): { ok: true } | { ok: false; tentarNovamenteEmMs: number };
};

export function criarRateLimiter(opcoes: { limite: number; janelaMs: number; agora?: () => number }): RateLimiter {
  const agora = opcoes.agora ?? Date.now;
  const janelas = new Map<string, { inicio: number; contagem: number }>();

  return {
    consumir(chave) {
      const t = agora();
      // Limpeza preguiçosa para o Map não crescer sem limite.
      if (janelas.size > 10_000) {
        for (const [k, j] of janelas) if (t - j.inicio >= opcoes.janelaMs) janelas.delete(k);
      }
      const janela = janelas.get(chave);
      if (!janela || t - janela.inicio >= opcoes.janelaMs) {
        janelas.set(chave, { inicio: t, contagem: 1 });
        return { ok: true };
      }
      if (janela.contagem >= opcoes.limite) {
        return { ok: false, tentarNovamenteEmMs: janela.inicio + opcoes.janelaMs - t };
      }
      janela.contagem++;
      return { ok: true };
    },
  };
}

/** IP do cliente para chave de rate limit (atrás de proxy, o primeiro de X-Forwarded-For). */
export function ipDoCliente(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "local";
}
