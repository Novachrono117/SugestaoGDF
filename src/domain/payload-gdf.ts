// Monta o JSON enviado ao GDF a partir dos dados já persistidos. Função pura.
// Não recebe dados do autor: o payload só informa se a denúncia é anônima (LGPD — minimização).
import type { PayloadGdfV1 } from "@/lib/validation/integracao-gdf";
import { resolverOrgaoSugerido, type OrgaoRef } from "./orgao";

export type DenunciaParaEnvio = {
  protocolo: string;
  criadoEm: Date;
  descricao: string;
  categoria: { slug: string; nome: string };
  latitude: number;
  longitude: number;
  enderecoReferencia: string | null;
  ra: { codigo: string; nome: string };
  anonima: boolean;
  anexos: Array<{ token: string; mime: string }>;
  sugestao: {
    categoriaSlug: string;
    orgao: OrgaoRef;
    confianca: number;
    justificativa: string;
    origem: "LLM" | "REGRAS";
    modelo: string;
    cidadaoConfirmou: boolean;
  };
};

export function montarPayloadGdf(d: DenunciaParaEnvio, appUrl: string): PayloadGdfV1 {
  const base = appUrl.replace(/\/+$/, "");
  return {
    versao: "1",
    protocolo: d.protocolo,
    criadoEm: d.criadoEm.toISOString(),
    descricao: d.descricao,
    categoria: { slug: d.categoria.slug, nome: d.categoria.nome },
    local: {
      latitude: d.latitude,
      longitude: d.longitude,
      enderecoReferencia: d.enderecoReferencia,
      ra: { codigo: d.ra.codigo, nome: d.ra.nome },
    },
    anexos: d.anexos.map((a) => ({ url: `${base}/api/v1/anexos/${a.token}`, mime: a.mime })),
    sugestaoIA: {
      categoriaSlug: d.sugestao.categoriaSlug,
      orgao: resolverOrgaoSugerido(d.sugestao.orgao, d.ra.nome),
      confianca: d.sugestao.confianca,
      justificativa: d.sugestao.justificativa,
      origem: d.sugestao.origem,
      modelo: d.sugestao.modelo,
      cidadaoConfirmou: d.sugestao.cidadaoConfirmou,
    },
    anonima: d.anonima,
    callbackUrl: `${base}/api/v1/integracao/gdf/eventos`,
  };
}
