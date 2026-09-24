"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alerta, Botao } from "@/components/ui";

export function BotaoApoiar({ protocolo }: { protocolo: string }) {
  const router = useRouter();
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function apoiar() {
    setPendente(true);
    setErro(null);
    try {
      const res = await fetch(`/api/v1/denuncias/${protocolo}/apoios`, { method: "POST" });
      if (!res.ok) {
        const corpo = await res.json().catch(() => null);
        return setErro(corpo?.error?.message ?? "Não foi possível registrar o apoio.");
      }
      router.replace(`/acompanhar/${protocolo}?apoio=1`);
      router.refresh();
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setPendente(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {erro && <Alerta>{erro}</Alerta>}
      <Botao type="button" variante="secundario" onClick={apoiar} disabled={pendente} className="self-start">
        {pendente ? "Apoiando…" : "👍 Também tenho esse problema"}
      </Botao>
    </div>
  );
}
