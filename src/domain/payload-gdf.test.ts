import { describe, expect, it } from "vitest";
import { callbackGdfSchema, payloadGdfV1Schema } from "@/lib/validation/integracao-gdf";
import { montarPayloadGdf, type DenunciaParaEnvio } from "./payload-gdf";

const denuncia: DenunciaParaEnvio = {
  protocolo: "DF-2026-000123",
  criadoEm: new Date("2026-09-23T14:05:00.000Z"),
  descricao: "Poste apagado há uma semana na quadra 12",
  categoria: { slug: "iluminacao-publica", nome: "Iluminação pública" },
  latitude: -15.8267,
  longitude: -48.1128,
  enderecoReferencia: "QNM 12, perto da escola",
  ra: { codigo: "RA-IX", nome: "Ceilândia" },
  anonima: true,
  anexos: [{ token: "abc123", mime: "image/jpeg" }],
  sugestao: {
    categoriaSlug: "iluminacao-publica",
    orgao: { sigla: "CEB-IPES", nome: "CEB Iluminação Pública e Serviços" },
    confianca: 0.86,
    justificativa: "Relato de poste sem luz.",
    origem: "LLM",
    modelo: "modelo-teste",
    cidadaoConfirmou: true,
  },
};

describe("montarPayloadGdf", () => {
  it("gera um payload válido pelo contrato v1", () => {
    const payload = montarPayloadGdf(denuncia, "http://localhost:3000/");
    expect(payloadGdfV1Schema.parse(payload)).toEqual(payload);
    expect(payload.anexos[0].url).toBe("http://localhost:3000/api/v1/anexos/abc123");
    expect(payload.callbackUrl).toBe("http://localhost:3000/api/v1/integracao/gdf/eventos");
  });

  it("resolve ADM-RA para a administração da RA da denúncia", () => {
    const payload = montarPayloadGdf(
      { ...denuncia, sugestao: { ...denuncia.sugestao, orgao: { sigla: "ADM-RA", nome: "Administração Regional da RA" } } },
      "http://localhost:3000",
    );
    expect(payload.sugestaoIA.orgao).toEqual({ sigla: "ADM-RA", nome: "Administração Regional de Ceilândia" });
  });

  it("contrato rejeita campos extras (ex.: dados pessoais)", () => {
    const payload = montarPayloadGdf(denuncia, "http://localhost:3000");
    expect(payloadGdfV1Schema.safeParse({ ...payload, email: "fulano@exemplo.com" }).success).toBe(false);
  });
});

describe("callbackGdfSchema", () => {
  const base = { eventoId: "e1", protocolo: "DF-2026-000123", ocorridoEm: "2026-09-23T15:00:00.000Z" };

  it("aceita status informados pelo GDF", () => {
    expect(callbackGdfSchema.safeParse({ ...base, status: "ENCAMINHADA", orgaoSigla: "SLU" }).success).toBe(true);
  });

  it.each(["RECEBIDA", "ENVIADA_GDF", "QUALQUER"])("rejeita status %s", (status) => {
    expect(callbackGdfSchema.safeParse({ ...base, status }).success).toBe(false);
  });
});
