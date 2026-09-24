import { describe, expect, it } from "vitest";
import { caixaDaGeometria, detectarRa, distanciaEmMetros, pontoNaGeometria, type Geometria, type RegiaoComLimite } from "./geo";

// Quadrado 0..10 com buraco 4..6 (coordenadas [lng, lat]).
const comBuraco: Geometria = {
  type: "Polygon",
  coordinates: [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
  ],
};
const duasIlhas: Geometria = {
  type: "MultiPolygon",
  coordinates: [
    [[[20, 20], [22, 20], [22, 22], [20, 22], [20, 20]]],
    [[[30, 30], [32, 30], [32, 32], [30, 32], [30, 30]]],
  ],
};

describe("pontoNaGeometria", () => {
  it("dentro, fora e no buraco", () => {
    expect(pontoNaGeometria(1, 1, comBuraco)).toBe(true); // lat 1, lng 1
    expect(pontoNaGeometria(5, 5, comBuraco)).toBe(false); // no buraco
    expect(pontoNaGeometria(11, 5, comBuraco)).toBe(false);
  });

  it("multipolígono: qualquer uma das partes", () => {
    expect(pontoNaGeometria(21, 21, duasIlhas)).toBe(true);
    expect(pontoNaGeometria(31, 31, duasIlhas)).toBe(true);
    expect(pontoNaGeometria(25, 25, duasIlhas)).toBe(false);
  });

  it("polígono côncavo (formato L)", () => {
    const L: Geometria = { type: "Polygon", coordinates: [[[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6], [0, 0]]] };
    expect(pontoNaGeometria(1, 1, L)).toBe(true);
    expect(pontoNaGeometria(5, 1, L)).toBe(true); // braço do L: lat 5, lng 1
    expect(pontoNaGeometria(4, 4, L)).toBe(false); // canto vazio
  });
});

describe("detectarRa", () => {
  const regioes: RegiaoComLimite[] = [
    { codigo: "RA-A", nome: "A", geometria: comBuraco, caixa: caixaDaGeometria(comBuraco) },
    { codigo: "RA-B", nome: "B", geometria: duasIlhas, caixa: caixaDaGeometria(duasIlhas) },
  ];

  it("acha a RA certa ou devolve null", () => {
    expect(detectarRa(2, 2, regioes)).toEqual({ codigo: "RA-A", nome: "A" });
    expect(detectarRa(31, 31, regioes)).toEqual({ codigo: "RA-B", nome: "B" });
    expect(detectarRa(5, 5, regioes)).toBeNull();
    expect(detectarRa(-50, -50, regioes)).toBeNull();
    expect(detectarRa(1, 1, [])).toBeNull();
  });

  it("calcula a caixa envolvente", () => {
    expect(caixaDaGeometria(duasIlhas)).toEqual({ minLng: 20, minLat: 20, maxLng: 32, maxLat: 32 });
  });
});

describe("distanciaEmMetros", () => {
  it("0 no mesmo ponto; ~111 m por 0,001° de latitude", () => {
    const p = { lat: -15.7939, lng: -47.8828 };
    expect(distanciaEmMetros(p, p)).toBe(0);
    expect(distanciaEmMetros(p, { lat: p.lat + 0.001, lng: p.lng })).toBeCloseTo(111.2, 0);
  });

  it("Esplanada → Taguatinga ≈ 19 km", () => {
    const d = distanciaEmMetros({ lat: -15.7998, lng: -47.8645 }, { lat: -15.834, lng: -48.0565 });
    expect(d / 1000).toBeGreaterThan(18);
    expect(d / 1000).toBeLessThan(22);
  });
});
