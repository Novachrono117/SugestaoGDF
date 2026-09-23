import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BuscaProtocolo } from "@/components/busca-protocolo";
import { Alerta, Cartao } from "@/components/ui";
import { normalizarProtocolo } from "@/domain/protocolo";

export const metadata: Metadata = { title: "Acompanhar denúncia — Voz DF" };

export default async function AcompanharPage({ searchParams }: PageProps<"/acompanhar">) {
  const { protocolo } = await searchParams;
  const digitado = typeof protocolo === "string" ? protocolo : "";
  const normalizado = digitado ? normalizarProtocolo(digitado) : null;
  if (normalizado) redirect(`/acompanhar/${normalizado}`);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <Cartao>
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Acompanhar denúncia</h1>
        <p className="mb-4 text-sm text-slate-600">Digite o protocolo que você recebeu ao registrar a denúncia.</p>
        {digitado && !normalizado && (
          <div className="mb-4">
            <Alerta>Protocolo inválido. O formato é DF-AAAA-NNNNNN (ex.: DF-2026-000123).</Alerta>
          </div>
        )}
        <BuscaProtocolo valorInicial={digitado} />
      </Cartao>
    </main>
  );
}
