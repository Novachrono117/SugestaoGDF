// Integração com os limites OFICIAIS (se `npm run ras:baixar` foi rodado; senão os testes são pulados).
import { afterAll, describe, expect, it } from "vitest";
import { criarBancoDeTeste } from "@/test/db";
import { detectarRaPorPonto, limitesDasRas } from "./regioes";

const banco = await criarBancoDeTeste();
afterAll(() => banco.fechar());
const temLimites = (await limitesDasRas(banco.db)).length > 0;

describe.skipIf(!temLimites)("detectarRaPorPonto (limites oficiais IDE-DF)", () => {
  it("carrega as 37 RAs", async () => {
    expect(await limitesDasRas(banco.db)).toHaveLength(37);
  });

  // Pontos centrais e conhecidos, longe das divisas.
  it.each([
    ["Esplanada dos Ministérios", -15.7998, -47.8645, "RA-I"],
    ["Centro de Taguatinga", -15.834, -48.0565, "RA-III"],
    ["Centro do Gama", -16.0189, -48.0628, "RA-II"],
    ["Centro de Ceilândia", -15.8196, -48.106, "RA-IX"],
  ])("%s → %s", async (_nome, lat, lng, esperado) => {
    expect((await detectarRaPorPonto(banco.db, lat, lng))?.codigo).toBe(esperado);
  });

  it("fora do DF → null", async () => {
    expect(await detectarRaPorPonto(banco.db, -16.6869, -49.2648)).toBeNull(); // Goiânia
  });
});
