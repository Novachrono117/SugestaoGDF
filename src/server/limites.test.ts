import { describe, expect, it } from "vitest";
import { criarLimites, fatorDosLimites } from "./limites";

describe("fatorDosLimites", () => {
  it("aceita inteiros de 1 a 100; qualquer outra coisa vira 1", () => {
    expect(fatorDosLimites("20")).toBe(20);
    expect(fatorDosLimites(undefined)).toBe(1);
    for (const invalido of ["0", "-3", "1.5", "101", "abc", ""]) expect(fatorDosLimites(invalido)).toBe(1);
  });
});

describe("criarLimites", () => {
  const esgotar = (l: { consumir(k: string): { ok: boolean } }) => {
    let n = 0;
    while (l.consumir("mesma-rede").ok) n++;
    return n;
  };

  it("multiplica os limites por IP (evento com todo mundo na mesma rede)", () => {
    expect(esgotar(criarLimites(1).cadastroPorIp)).toBe(5);
    expect(esgotar(criarLimites(20).cadastroPorIp)).toBe(100);
    expect(esgotar(criarLimites(20).classificacaoPorIp)).toBe(600);
  });

  it("não afrouxa o limite de login por e-mail (proteção contra adivinhar senha)", () => {
    expect(esgotar(criarLimites(20).loginPorEmail)).toBe(5);
  });
});
