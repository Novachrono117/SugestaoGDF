// Geração de CSV segura para abrir no Excel/Sheets.
// - separador ";" e BOM UTF-8 (Excel em pt-BR lê acentos e colunas corretamente);
// - aspas em todas as células, aspas internas duplicadas;
// - proteção contra CSV/formula injection: célula que começa com = + - @ (ou tab/CR) ganha um ' na frente.

export type Coluna<T> = { titulo: string; valor: (linha: T) => string | number | boolean | null | undefined };

const INICIO_PERIGOSO = /^[=+\-@\t\r]/;

export function celulaCsv(valor: string | number | boolean | null | undefined): string {
  if (valor === null || valor === undefined) return '""';
  let texto = String(valor);
  if (typeof valor === "string" && INICIO_PERIGOSO.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
}

export function paraCsv<T>(linhas: T[], colunas: Coluna<T>[]): string {
  const cabecalho = colunas.map((c) => celulaCsv(c.titulo)).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => celulaCsv(c.valor(l))).join(";"));
  return `﻿${[cabecalho, ...corpo].join("\r\n")}\r\n`;
}
