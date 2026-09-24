// Relatórios: indicadores públicos (agregados, sem dados pessoais) e CSV do operador (sem relato).
import { paraCsv, type Coluna } from "@/domain/csv";
import { calcularIndicadores, type LinhaIndicador } from "@/domain/indicadores";
import type { PrismaClient } from "../../generated/prisma/client";
import { listarManifestacoes, rotuloSimulador, type Manifestacao } from "../simulador-gdf/servico";

export async function indicadoresPublicos(db: PrismaClient) {
  const denuncias = await db.denuncia.findMany({
    select: {
      status: true,
      criadoEm: true,
      resolvidoEm: true,
      ra: { select: { nome: true } },
      categoria: { select: { nome: true } },
      orgaoResponsavel: { select: { sigla: true } },
      avaliacoes: { select: { tipo: true }, orderBy: { criadoEm: "desc" } },
    },
  });
  const linhas: LinhaIndicador[] = denuncias.map((d) => ({
    status: d.status,
    ra: d.ra.nome,
    categoria: d.categoria.nome,
    orgao: d.orgaoResponsavel?.sigla ?? null,
    criadoEm: d.criadoEm,
    resolvidoEm: d.resolvidoEm,
    confirmada: d.status === "RESOLVIDA" && d.avaliacoes[0]?.tipo === "CONFIRMADA",
    contestada: d.avaliacoes.some((a) => a.tipo === "CONTESTADA"),
  }));
  return { ...calcularIndicadores(linhas), geradoEm: new Date() };
}

const formatoData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

const COLUNAS_CSV: Coluna<Manifestacao>[] = [
  { titulo: "Protocolo", valor: (m) => m.protocolo },
  { titulo: "Recebida em", valor: (m) => formatoData.format(m.recebidoEm) },
  { titulo: "Categoria", valor: (m) => m.payload.categoria.nome },
  { titulo: "RA", valor: (m) => m.payload.local.ra.nome },
  { titulo: "Status", valor: (m) => rotuloSimulador(m.status) },
  { titulo: "Órgão sugerido pela IA", valor: (m) => m.payload.sugestaoIA.orgao.sigla },
  { titulo: "Órgão decidido pelo GDF", valor: (m) => m.orgaoDecididoSigla },
  { titulo: "IA acertou a categoria", valor: (m) => (m.iaAcertou === null ? "" : m.iaAcertou ? "sim" : "não") },
  { titulo: "Categoria correta (se errou)", valor: (m) => m.categoriaCorretaSlug },
  { titulo: "Apoios", valor: (m) => m.totalApoios },
  { titulo: "Retorno do cidadão", valor: (m) => m.avaliacaoCidadao },
  { titulo: "Anônima", valor: (m) => (m.payload.anonima ? "sim" : "não") },
];

/** CSV do Simulador GDF. Sem o relato: não é necessário para relatório (minimização). */
export async function csvDoSimulador(db: PrismaClient): Promise<string> {
  return paraCsv(await listarManifestacoes(db), COLUNAS_CSV);
}
