// Porta de saída para o sistema do governo (docs/ARQUITETURA.md §2).
// No MVP o destino é o Simulador GDF; uma integração real (ex.: Fala.BR) implementa a mesma interface.
import type { PayloadGdfV1 } from "@/lib/validation/integracao-gdf";

export type ResultadoEnvio = { ok: true; idExterno: string | null } | { ok: false; erro: string };

export interface GovGateway {
  enviar(payload: PayloadGdfV1): Promise<ResultadoEnvio>;
}

export type HttpGovGatewayConfig = {
  url: string;
  chave: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
};

/** Push HTTP: POST do JSON com `Authorization: Bearer`. Nunca lança — falha vira `{ ok: false }`. */
export class HttpGovGateway implements GovGateway {
  constructor(private readonly config: HttpGovGatewayConfig) {}

  async enviar(payload: PayloadGdfV1): Promise<ResultadoEnvio> {
    const fetchFn = this.config.fetchFn ?? fetch;
    try {
      const res = await fetchFn(this.config.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.chave}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      if (!res.ok) return { ok: false, erro: `GDF respondeu HTTP ${res.status}` };
      const corpo: unknown = await res.json().catch(() => null);
      const idExterno =
        corpo && typeof corpo === "object" && "idExterno" in corpo && typeof corpo.idExterno === "string"
          ? corpo.idExterno
          : null;
      return { ok: true, idExterno };
    } catch (erro) {
      const nome = erro instanceof Error ? erro.name : "";
      return { ok: false, erro: nome === "TimeoutError" ? "Tempo esgotado ao contatar o GDF" : "Falha de rede ao contatar o GDF" };
    }
  }
}
