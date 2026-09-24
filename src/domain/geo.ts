// Geometria mínima para descobrir a RA de um ponto (sem PostGIS: 37 polígonos cabem em memória).
// Coordenadas GeoJSON: [longitude, latitude].

type Posicao = number[]; // [lng, lat, ...]
type Anel = Posicao[];
export type Geometria = { type: "Polygon"; coordinates: Anel[] } | { type: "MultiPolygon"; coordinates: Anel[][] };

/** Ray casting: conta quantas arestas um raio horizontal a partir do ponto cruza. */
function pontoNoAnel(lng: number, lat: number, anel: Anel): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    const cruza = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

/** Polígono = anel externo menos os buracos (anéis seguintes). */
function pontoNoPoligono(lng: number, lat: number, aneis: Anel[]): boolean {
  if (!aneis.length || !pontoNoAnel(lng, lat, aneis[0])) return false;
  return !aneis.slice(1).some((buraco) => pontoNoAnel(lng, lat, buraco));
}

export function pontoNaGeometria(lat: number, lng: number, g: Geometria): boolean {
  return g.type === "Polygon"
    ? pontoNoPoligono(lng, lat, g.coordinates)
    : g.coordinates.some((poligono) => pontoNoPoligono(lng, lat, poligono));
}

export type Caixa = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export function caixaDaGeometria(g: Geometria): Caixa {
  const caixa = { minLng: Infinity, minLat: Infinity, maxLng: -Infinity, maxLat: -Infinity };
  const aneis = g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
  for (const anel of aneis) {
    for (const [lng, lat] of anel) {
      caixa.minLng = Math.min(caixa.minLng, lng);
      caixa.maxLng = Math.max(caixa.maxLng, lng);
      caixa.minLat = Math.min(caixa.minLat, lat);
      caixa.maxLat = Math.max(caixa.maxLat, lat);
    }
  }
  return caixa;
}

export type RegiaoComLimite = { codigo: string; nome: string; geometria: Geometria; caixa: Caixa };

/** RA que contém o ponto, ou null (fora do DF, em área sem RA ou sem limites carregados). */
export function detectarRa(lat: number, lng: number, regioes: RegiaoComLimite[]): { codigo: string; nome: string } | null {
  for (const r of regioes) {
    const { minLng, minLat, maxLng, maxLat } = r.caixa;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue; // descarte barato
    if (pontoNaGeometria(lat, lng, r.geometria)) return { codigo: r.codigo, nome: r.nome };
  }
  return null;
}
