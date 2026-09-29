// Dados FICTÍCIOS para a apresentação (banco vozdf_demo, via scripts/demo.mjs). Cada denúncia percorre o
// caminho real, em processo e sem HTTP: IA (ou regras, se ela falhar) → push ao simulador → decisões do "GDF" →
// callback → histórico. Depois as datas são recuadas para parecer uso de algumas semanas.
import "dotenv/config";
import { entradaCallbackGdfSchema } from "../src/lib/validation/integracao-gdf";
import { criarClassificador } from "../src/server/classificador";
import { apoiar } from "../src/server/denuncias/apoios";
import { avaliarResolucao } from "../src/server/denuncias/avaliacao-cidadao";
import { criarDenuncia } from "../src/server/denuncias/criar";
import { ErroDominio } from "../src/server/erros";
import type { GovGateway } from "../src/server/gov-gateway";
import { aplicarAvaliacaoIa } from "../src/server/integracao/avaliacao-ia";
import { aplicarEventoGdf } from "../src/server/integracao/callback-gdf";
import { createPrismaClient } from "../src/server/prisma";
import { detectarRaPorPonto } from "../src/server/regioes";
import { receberApoios, receberAvaliacaoCidadao, receberManifestacao } from "../src/simulador-gdf/receber";
import { decidir, registrarAvaliacaoIa } from "../src/simulador-gdf/servico";

type Passo = "ENVIADA" | "EM_ANALISE" | "ENCAMINHADA" | "EM_EXECUCAO" | "RESOLVIDA" | "CONFIRMADA" | "NAO_PROCEDENTE";

// [relato, categoria, RA esperada, lat, lng, até onde vai, dias atrás, órgão que o "GDF" escolhe]
const CASOS: [string, string, string, number, number, Passo, number, string?][] = [
  ["O poste da minha rua está apagado faz duas semanas e a rua fica um breu à noite.", "iluminacao-publica", "RA-IX", -15.8195, -48.1085, "CONFIRMADA", 20, "CEB-IPES"],
  ["Buraco enorme no meio da pista, já vi moto caindo ali.", "buracos-vias", "RA-III", -15.8335, -48.0565, "RESOLVIDA", 16, "NOVACAP"],
  ["Lixo acumulado na esquina há mais de uma semana, cheio de mosquito.", "lixo-entulho", "RA-XII", -15.8765, -48.0875, "EM_EXECUCAO", 9, "SLU"],
  ["Quando chove a rua inteira alaga e a água entra nas casas.", "alagamento-drenagem", "RA-XV", -15.9145, -48.0625, "ENCAMINHADA", 7, "NOVACAP"],
  ["Esgoto vazando na calçada perto da escola, cheiro muito forte.", "agua-esgoto", "RA-II", -16.0160, -48.0645, "EM_ANALISE", 3, undefined],
  ["Parada de ônibus sem cobertura e com o banco quebrado.", "transporte-publico", "RA-I", -15.7942, -47.8830, "ENVIADA", 1, undefined],
  ["Semáforo do cruzamento está desligado desde ontem, muito perigoso.", "transito-sinalizacao", "RA-X", -15.8232, -47.9762, "RESOLVIDA", 12, "DETRAN-DF"],
  ["Calçada toda quebrada, cadeirante não consegue passar.", "acessibilidade", "RA-XX", -15.8402, -48.0272, "ENCAMINHADA", 6, "ADM-RA"],
  ["Entulho de obra jogado no terreno baldio ao lado da quadra.", "lixo-entulho", "RA-VI", -15.6205, -47.6535, "EM_ANALISE", 4, undefined],
  ["Praça com os brinquedos quebrados e mato alto.", "areas-lazer", "RA-V", -15.6535, -47.7905, "EM_EXECUCAO", 10, "ADM-RA"],
  ["Poste piscando a noite toda na rua principal.", "iluminacao-publica", "RA-XIV", -15.9025, -47.7765, "ENVIADA", 0, undefined],
  ["Buraco na via marginal está aumentando a cada chuva.", "buracos-vias", "RA-IX", -15.8210, -48.1100, "ENCAMINHADA", 5, "NOVACAP"],
  ["Som alto todo fim de semana até de madrugada no bar da esquina.", "poluicao-sonora", "RA-VII", -15.7735, -47.7805, "NAO_PROCEDENTE", 8, undefined],
  ["Cachorros abandonados na praça, alguns machucados.", "animais", "RA-IV", -15.6705, -48.2005, "EM_ANALISE", 2, undefined],
  ["Falta de água no bairro há três dias.", "agua-esgoto", "RA-XIII", -16.0200, -47.9870, "RESOLVIDA", 14, "CAESB"],
  ["Rua escura e sem iluminação perto da parada, ninguém tem coragem de passar.", "iluminacao-publica", "RA-III", -15.8350, -48.0540, "EM_EXECUCAO", 11, "CEB-IPES"],
];

const TEXTO_RESOLVIDA = "Serviço concluído pela equipe responsável.";

async function main() {
  const db = createPrismaClient();
  const cidada = await db.usuario.findUnique({ where: { email: "cidada@vozdf.example" }, select: { id: true } });
  if (!cidada) throw new Error("Rode o seed com os usuários de demonstração antes (cidada@vozdf.example).");
  const vizinhos = await Promise.all(
    ["vizinho1", "vizinho2", "vizinho3"].map((n, i) =>
      db.usuario.upsert({
        where: { email: `${n}@vozdf.example` },
        update: {},
        create: { nome: `Vizinho ${i + 1} (fictício)`, email: `${n}@vozdf.example`, senhaHash: "sem-login" },
        select: { id: true },
      }),
    ),
  );

  const gateway: GovGateway = {
    enviar: async (p) => ({ ok: true, ...(await receberManifestacao(db, p)) }),
    enviarAvaliacao: async (a) => (await receberAvaliacaoCidadao(db, a), { ok: true, idExterno: null }),
    enviarApoios: async (a) => (await receberApoios(db, a), { ok: true, idExterno: null }),
  };
  // Callback "entregue" direto ao Voz DF, com as mesmas validações do route handler.
  const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
    try {
      const e = entradaCallbackGdfSchema.parse(JSON.parse(String(init?.body)));
      return Response.json(e.tipo === "AVALIACAO_IA" ? await aplicarAvaliacaoIa(db, e) : await aplicarEventoGdf(db, e));
    } catch (e) {
      const status = e instanceof ErroDominio ? e.status : 500;
      return Response.json({ error: { code: "X", message: String(e) } }, { status });
    }
  }) as typeof fetch;
  const gdf = { db, chaveCallback: "demo", fetchFn };
  // A IA de verdade (Ollama) com fallback por regras: o "acerto da IA segundo o GDF" no simulador é real.
  const classificador = criarClassificador();

  let n = 0;
  for (const [descricao, categoriaSlug, raEsperada, latitude, longitude, ate, diasAtras, orgao] of CASOS) {
    const raCodigo = (await detectarRaPorPonto(db, latitude, longitude))?.codigo ?? raEsperada;
    const comConta = ate === "CONFIRMADA" || n % 3 === 0;
    const { protocolo } = await criarDenuncia(
      { db, gateway, appUrl: "http://localhost:3000", classificador },
      { descricao, categoriaSlug, raCodigo, latitude, longitude, enderecoReferencia: null },
      comConta ? cidada.id : null,
    );
    const passos = ["EM_ANALISE", "ENCAMINHADA", "EM_EXECUCAO", "RESOLVIDA"] as const;
    if (ate === "NAO_PROCEDENTE") {
      await decidir(gdf, { protocolo, status: "EM_ANALISE" });
      await decidir(gdf, { protocolo, status: "NAO_PROCEDENTE", texto: "Fora da competência do GDF: acione a Polícia Militar (190)." });
    } else if (ate !== "ENVIADA") {
      const limite = (ate === "CONFIRMADA" ? "RESOLVIDA" : ate) as (typeof passos)[number];
      for (const status of passos.slice(0, passos.indexOf(limite) + 1)) {
        await decidir(gdf, {
          protocolo,
          status,
          ...(status === "ENCAMINHADA" && { orgaoSigla: orgao }),
          ...(status === "RESOLVIDA" && { texto: TEXTO_RESOLVIDA }),
        });
      }
      // Operador avalia a IA nas que andaram (acerto real da sugestão).
      const s = await db.sugestaoIA.findFirstOrThrow({ where: { denuncia: { protocolo } }, select: { categoria: { select: { slug: true } } } });
      await registrarAvaliacaoIa(gdf, { protocolo, acertou: s.categoria.slug === categoriaSlug, categoriaCorretaSlug: categoriaSlug });
    }
    if (ate === "CONFIRMADA") await avaliarResolucao({ db, gateway }, { protocolo, usuarioId: cidada.id, resolvido: true });
    // Apoios da vizinhança nas que estão em andamento.
    if (["EM_ANALISE", "ENCAMINHADA", "EM_EXECUCAO"].includes(ate)) {
      for (const v of vizinhos.slice(0, (n % 3) + 1)) await apoiar({ db, gateway }, protocolo, v.id);
    }

    // Recuo das datas: criada há `diasAtras` dias; eventos espalhados em ordem entre a criação e agora
    // (nunca no futuro); resolução = data do evento "Resolvida".
    const horas = diasAtras * 24 || 2;
    await db.$executeRaw`UPDATE "EventoDenuncia" e
      SET "criadoEm" = now() - (${horas} * interval '1 hour') * (1 - o.i::float8 / o.total)
      FROM (SELECT id, row_number() OVER (ORDER BY "criadoEm", id) - 1 AS i, count(*) OVER () AS total
            FROM "EventoDenuncia" WHERE "denunciaId" = (SELECT id FROM "Denuncia" WHERE protocolo = ${protocolo})) o
      WHERE e.id = o.id`;
    await db.$executeRaw`UPDATE "Denuncia" d SET "criadoEm" = now() - ${horas} * interval '1 hour',
      "resolvidoEm" = CASE WHEN d."resolvidoEm" IS NULL THEN NULL ELSE
        (SELECT max(e."criadoEm") FROM "EventoDenuncia" e WHERE e."denunciaId" = d.id AND e."statusPara" = 'RESOLVIDA') END
      WHERE d.protocolo = ${protocolo}`;
    await db.$executeRaw`UPDATE "ManifestacaoGdf" SET "recebidoEm" = now() - ${horas} * interval '1 hour' WHERE protocolo = ${protocolo}`;
    n++;
    console.log(`${protocolo}  ${raCodigo.padEnd(9)} ${ate.padEnd(14)} ${descricao.slice(0, 50)}…`);
  }
  console.log(`\n${n} denúncias fictícias criadas.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
