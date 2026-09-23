import type { Metadata } from "next";
import { Alerta } from "@/components/ui";
import { exigirUsuario } from "@/server/auth/sessao";

export const metadata: Metadata = { title: "Simulador GDF — Voz DF" };

// Tela completa no passo 8 do roadmap; por ora valida o controle de acesso por papel.
export default async function SimuladorPage() {
  const operador = await exigirUsuario("OPERADOR_GDF", "/simulador-gdf");
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">
      <h1 className="mb-2 text-2xl font-bold">Simulador GDF</h1>
      <Alerta tipo="info">
        Somente demonstração: esta tela faz o papel do sistema do governo. Conectado como {operador.nome}.
      </Alerta>
    </main>
  );
}
