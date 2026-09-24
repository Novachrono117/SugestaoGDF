// Porta de saída para o sistema do governo (docs/ARQUITETURA.md §2).
// No MVP o destino é o Simulador GDF; uma integração real (ex.: Fala.BR) implementa a mesma interface.
import type { ApoiosGdf, AvaliacaoCidadaoGdf, PayloadGdfV1 } from "@/lib/validation/integracao-gdf";

export type ResultadoEnvio = { ok: true; idExterno: string | null } | { ok: false; erro: string };

export interface GovGateway {
  enviar(payload: PayloadGdfV1): Promise<ResultadoEnvio>;
  /** Confirmação/contestação da resolução pelo cidadão. */
  enviarAvaliacao(avaliacao: AvaliacaoCidadaoGdf): Promise<ResultadoEnvio>;
  /** Total de apoios da comunidade (sinal de prioridade para o GDF). */
  enviarApoios(apoios: ApoiosGdf): Promise<ResultadoEnvio>;
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

  enviar(payload: PayloadGdfV1): Promise<ResultadoEnvio> {
    return this.post(this.config.url, payload);
  }

  enviarAvaliacao(avaliacao: AvaliacaoCidadaoGdf): Promise<ResultadoEnvio> {
    // Sub-recurso da manifestação: {GDF_WEBHOOK_URL}/{protocolo}/avaliacoes-cidadao
    const base = this.config.url.replace(/\/+$/, "");
    return this.post(`${base}/${encodeURIComponent(avaliacao.protocolo)}/avaliacoes-cidadao`, avaliacao);
  }

  enviarApoios(apoios: ApoiosGdf): Promise<ResultadoEnvio> {
    const base = this.config.url.replace(/\/+$/, "");
    return this.post(`${base}/${encodeURIComponent(apoios.protocolo)}/apoios`, apoios);
  }

  private async post(url: string, corpoJson: unknown): Promise<ResultadoEnvio> {
    const fetchFn = this.config.fetchFn ?? fetch;
    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.chave}` },
        body: JSON.stringify(corpoJson),
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
