// Órgão sugerido para uma categoria. "ADM-RA" é genérico no seed (uma entrada para as 35
// administrações); na sugestão ele vira a Administração Regional da RA da denúncia.

export const SIGLA_ADMINISTRACAO_REGIONAL = "ADM-RA";

export type OrgaoRef = { sigla: string; nome: string };

export function resolverOrgaoSugerido(orgaoPadrao: OrgaoRef, raNome: string): OrgaoRef {
  if (orgaoPadrao.sigla !== SIGLA_ADMINISTRACAO_REGIONAL) return orgaoPadrao;
  // Formato neutro: a preposição varia por RA ("do Gama", "de Ceilândia", "do Plano Piloto").
  return { sigla: SIGLA_ADMINISTRACAO_REGIONAL, nome: `Administração Regional – ${raNome}` };
}
