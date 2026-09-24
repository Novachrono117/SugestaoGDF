// Baixa os limites oficiais das RAs (IDE-DF / SEDUH, camada LIMITES → Regiões Administrativas) para
// data/cache/ras-oficiais.geojson — FORA do git: a licença dos dados não está declarada (ver ARQUITETURA §7).
// Uso: npm run ras:baixar   (depois: npm run db:seed para gravar os polígonos no banco)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const SERVICO =
  "https://www.geoservicos.ide.df.gov.br/arcgis/rest/services/Publico/LIMITES/FeatureServer/1/query";
export const ARQUIVO_CACHE = join(process.cwd(), "data", "cache", "ras-oficiais.geojson");

const posicao = z.tuple([z.number(), z.number()]).rest(z.number());
const geometriaSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(posicao)) }),
  z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(z.array(posicao))) }),
]);
const respostaSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      properties: z.object({ ra_codigo: z.string(), ra_nome: z.string() }),
      geometry: geometriaSchema,
    }),
  ),
});

/** "XXXVII" (sem prefixo, como vem na camada oficial) → "RA-XXXVII". */
export function normalizarCodigo(codigo: string): string {
  const c = codigo.trim().toUpperCase();
  return c.startsWith("RA-") ? c : `RA-${c}`;
}

async function main() {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "ra_codigo,ra_nome",
    returnGeometry: "true",
    outSR: "4326", // WGS84 (lat/lng), o mesmo do Leaflet
    maxAllowableOffset: "0.0001", // simplifica para ~10 m: suficiente para saber a RA, arquivo bem menor
    geometryPrecision: "6",
    f: "geojson",
  });
  const res = await fetch(`${SERVICO}?${params}`, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Geoserviço respondeu HTTP ${res.status}`);
  const dados = respostaSchema.parse(await res.json());

  const esperadas = new Set(
    (JSON.parse(readFileSync(join(process.cwd(), "data", "regioes-administrativas.json"), "utf-8")) as {
      regioes: { codigo: string }[];
    }).regioes.map((r) => r.codigo),
  );
  const features = dados.features.map((f) => ({
    type: "Feature" as const,
    properties: { codigo: normalizarCodigo(f.properties.ra_codigo), nomeOficial: f.properties.ra_nome },
    geometry: f.geometry,
  }));
  const codigos = new Set(features.map((f) => f.properties.codigo));
  const faltando = [...esperadas].filter((c) => !codigos.has(c));
  const desconhecidas = [...codigos].filter((c) => !esperadas.has(c));
  if (faltando.length || desconhecidas.length) {
    throw new Error(`Camada oficial difere do seed — faltando: [${faltando}] desconhecidas: [${desconhecidas}]`);
  }

  mkdirSync(join(process.cwd(), "data", "cache"), { recursive: true });
  const conteudo = JSON.stringify({
    type: "FeatureCollection",
    metadata: {
      fonte: "IDE-DF / SEDUH — geoserviço Publico/LIMITES, camada 1 (Regiões Administrativas)",
      url: SERVICO,
      baixadoEm: new Date().toISOString(),
      simplificacao: "maxAllowableOffset 0.0001° (~10 m), WGS84",
      aviso: "Licença não declarada pela fonte: não redistribuir; uso acadêmico com citação da fonte.",
    },
    features,
  });
  writeFileSync(ARQUIVO_CACHE, conteudo);
  console.log(`${features.length} RAs salvas em data/cache/ras-oficiais.geojson (${(conteudo.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
