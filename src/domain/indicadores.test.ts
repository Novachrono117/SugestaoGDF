import { describe, expect, it } from "vitest";
import { celulaCsv, paraCsv } from "./csv";
import { calcularIndicadores, type LinhaIndicador } from "./indicadores";

const d = (dia: number) => new Date(Date.UTC(2026, 8, dia));
const linha = (p: Partial<LinhaIndicador>): LinhaIndicador => ({
  status: "EM_ANALISE",
  ra: "Ceilândia",
  categoria: "Iluminação pública",
  orgao: null,
  criadoEm: d(1),
  resolvidoEm: null,
  confirmada: false,
  contestada: false,
  ...p,
});

describe("calcularIndicadores", () => {
  const linhas = [
    linha({ status: "RESOLVIDA", resolvidoEm: d(3), orgao: "CEB-IPES", confirmada: true }), // 2 dias
    linha({ status: "RESOLVIDA", resolvidoEm: d(7), orgao: "CEB-IPES" }), // 6 dias
    linha({ status: "EM_EXECUCAO", orgao: "CEB-IPES" }),
    linha({ status: "NAO_PROCEDENTE" }), // fora do percentual
    linha({ status: "REABERTA", ra: "Gama", categoria: "Buracos e pavimentação", contestada: true }),
  ];
  const r = calcularIndicadores(linhas);

  it("geral: percentual entre procedentes e tempo médio de resolução", () => {
    expect(r.geral).toMatchObject({
      total: 5,
      resolvidas: 2,
      emAndamento: 2,
      percentualResolvidas: 50, // 2 de 4 procedentes
      diasMedioResolucao: 4, // (2 + 6) / 2
      confirmadas: 1,
      contestadas: 1,
    });
  });

  it("agrupa por RA, categoria e órgão (só encaminhadas), maior primeiro", () => {
    expect(r.porRa.map((i) => [i.nome, i.total])).toEqual([["Ceilândia", 4], ["Gama", 1]]);
    expect(r.porOrgao).toHaveLength(1);
    expect(r.porOrgao[0]).toMatchObject({ nome: "CEB-IPES", total: 3, percentualResolvidas: 67 });
    expect(r.porCategoria.find((i) => i.nome === "Buracos e pavimentação")?.percentualResolvidas).toBe(0);
  });

  it("sem dados → nulos, não zero enganoso", () => {
    expect(calcularIndicadores([]).geral).toMatchObject({ total: 0, percentualResolvidas: null, diasMedioResolucao: null });
  });
});

describe("CSV seguro", () => {
  it("neutraliza fórmulas e escapa aspas", () => {
    expect(celulaCsv("=HYPERLINK(\"http://mal.example\")")).toBe(`"'=HYPERLINK(""http://mal.example"")"`);
    expect(celulaCsv("+55 61")).toBe(`"'+55 61"`);
    expect(celulaCsv("@SOMA(A1)")).toBe(`"'@SOMA(A1)"`);
    expect(celulaCsv("-15.79")).toBe(`"'-15.79"`); // string: protegida
    expect(celulaCsv(-15.79)).toBe(`"-15.79"`); // número: mantido
    expect(celulaCsv(null)).toBe('""');
  });

  it("gera cabeçalho, ; como separador, CRLF e BOM", () => {
    const csv = paraCsv([{ a: "x;y", b: 2 }], [
      { titulo: "A", valor: (l) => l.a },
      { titulo: "B", valor: (l) => l.b },
    ]);
    expect(csv).toBe('﻿"A";"B"\r\n"x;y";"2"\r\n');
  });
});
