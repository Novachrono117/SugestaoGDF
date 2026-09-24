"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alerta, Botao } from "@/components/ui";
import type { DenunciaProxima } from "@/server/denuncias/apoios";

function quando(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return dias <= 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`;
}

/** "Pode ser o mesmo problema?" — denúncias em andamento da mesma categoria perto do ponto. */
export function CartaoDuplicatas({
  itens,
  categoriaNome,
  logado,
  onIgnorar,
}: {
  itens: DenunciaProxima[];
  categoriaNome: string;
  logado: boolean;
  onIgnorar: () => void;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function apoiar(protocolo: string) {
    setEnviando(protocolo);
    setErro(null);
    try {
      const res = await fetch(`/api/v1/denuncias/${protocolo}/apoios`, { method: "POST" });
      if (!res.ok) {
        const corpo = await res.json().catch(() => null);
        return setErro(corpo?.error?.message ?? "Não foi possível registrar o apoio.");
      }
      router.push(`/acompanhar/${protocolo}?apoio=1`);
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4" aria-labelledby="titulo-duplicatas">
      <h3 id="titulo-duplicatas" className="text-base font-semibold text-slate-900">
        Pode ser o mesmo problema?
      </h3>
      <p className="mt-1 text-sm text-slate-700">
        Já existe{itens.length > 1 ? "m" : ""} denúncia{itens.length > 1 ? "s" : ""} de <strong>{categoriaNome}</strong> perto
        desse local. Apoiar uma delas mostra ao GDF que o problema afeta mais gente — e evita retrabalho.
      </p>
      {erro && (
        <div className="mt-3">
          <Alerta>{erro}</Alerta>
        </div>
      )}
      <ul className="mt-3 flex flex-col gap-2">
        {itens.map((d) => (
          <li key={d.protocolo} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-slate-800">
              A ~{d.distanciaM} m · {quando(d.criadoEm)} · {d.statusRotulo}
              {d.totalApoios > 0 && ` · ${d.totalApoios} apoio(s)`}
              <br />
              <Link href={`/acompanhar/${d.protocolo}`} target="_blank" className="font-mono text-xs text-blue-700 underline">
                {d.protocolo}
              </Link>
            </span>
            {logado ? (
              <Botao type="button" onClick={() => apoiar(d.protocolo)} disabled={enviando !== null} className="shrink-0">
                {enviando === d.protocolo ? "Apoiando…" : "Apoiar esta denúncia"}
              </Botao>
            ) : (
              <Link href="/entrar?voltar=/denunciar" className="shrink-0 text-sm font-semibold text-blue-700 underline">
                Entre para apoiar
              </Link>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onIgnorar} className="mt-3 text-sm font-semibold text-slate-700 underline">
        Não, é outro problema — continuar minha denúncia
      </button>
    </section>
  );
}
