// Indicadores agregados de transparência (sem dados pessoais). Função pura: recebe linhas mínimas.
import type { Status } from "./status";

export type LinhaIndicador = {
  status: Status;
  ra: string;
  categoria: string;
  orgao: string | null; // definido pelo GDF
  criadoEm: Date;
  resolvidoEm: Date | null;
  confirmada: boolean; // o cidadão confirmou a resolução
  contestada: boolean;
};

export type Indicador = {
  nome: string;
  total: number;
  resolvidas: number;
  emAndamento: number;
  percentualResolvidas: number | null; // entre as procedentes; null sem base
  diasMedioResolucao: number | null;
  confirmadas: number;
  contestadas: number;
};

const FORA_DA_CONTA: Status[] = ["NAO_PROCEDENTE", "DUPLICADA"];
const DIA_MS = 86_400_000;

function agregar(nome: string, linhas: LinhaIndicador[]): Indicador {
  const procedentes = linhas.filter((l) => !FORA_DA_CONTA.includes(l.status));
  const resolvidas = procedentes.filter((l) => l.status === "RESOLVIDA" && l.resolvidoEm);
  const dias = resolvidas.map((l) => (l.resolvidoEm!.getTime() - l.criadoEm.getTime()) / DIA_MS);
  return {
    nome,
    total: linhas.length,
    resolvidas: resolvidas.length,
    emAndamento: procedentes.length - resolvidas.length,
    percentualResolvidas: procedentes.length ? Math.round((resolvidas.length / procedentes.length) * 100) : null,
    diasMedioResolucao: dias.length ? Math.round((dias.reduce((a, b) => a + b, 0) / dias.length) * 10) / 10 : null,
    confirmadas: linhas.filter((l) => l.confirmada).length,
    contestadas: linhas.filter((l) => l.contestada).length,
  };
}

function agruparPor(linhas: LinhaIndicador[], chave: (l: LinhaIndicador) => string | null): Indicador[] {
  const grupos = new Map<string, LinhaIndicador[]>();
  for (const l of linhas) {
    const k = chave(l);
    if (k) grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }
  return [...grupos.entries()]
    .map(([nome, ls]) => agregar(nome, ls))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function calcularIndicadores(linhas: LinhaIndicador[]) {
  return {
    geral: agregar("Distrito Federal", linhas),
    porRa: agruparPor(linhas, (l) => l.ra),
    porCategoria: agruparPor(linhas, (l) => l.categoria),
    porOrgao: agruparPor(linhas, (l) => l.orgao), // só as já encaminhadas pelo GDF
  };
}
