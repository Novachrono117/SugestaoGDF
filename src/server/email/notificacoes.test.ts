import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { CallbackGdf } from "@/lib/validation/integracao-gdf";
import { criarBancoDeTeste } from "@/test/db";
import { criarDenuncia } from "../denuncias/criar";
import { aplicarEventoGdf } from "../integracao/callback-gdf";
import { processarEmailsPendentes, type EnviadorEmail } from "./notificacoes";

const banco = await criarBancoDeTeste();
const db = banco.db;
afterAll(() => banco.fechar());

const NOTIFICAR = { appUrl: "http://voz.test" };
let autora: string;
let seq = 0;

beforeAll(async () => {
  autora = (await db.usuario.create({ data: { nome: "Ana", email: "ana@vozdf.example", senhaHash: "x" } })).id;
});

async function denunciaEnviada(autorId: string | null) {
  const { protocolo } = await criarDenuncia(
    {
      db,
      appUrl: "http://voz.test",
      gateway: { enviar: async () => ({ ok: true, idExterno: null }), enviarAvaliacao: async () => ({ ok: true, idExterno: null }), enviarApoios: async () => ({ ok: true, idExterno: null }) },
      classificador: {
        nome: "fixo",
        classificar: async () => ({
          categoriaSlug: "iluminacao-publica", orgaoSigla: "CEB-IPES", confianca: 0.9,
          justificativa: "x", alternativas: [], origem: "REGRAS", modelo: "r",
        }),
      },
    },
    { descricao: "Poste apagado perto da casa da Dona Maria", categoriaSlug: "iluminacao-publica", raCodigo: "RA-IX",
      latitude: -15.82, longitude: -48.11, enderecoReferencia: null },
    autorId,
  );
  return protocolo;
}

const evento = (protocolo: string, extra: Pick<CallbackGdf, "status"> & Partial<CallbackGdf>): CallbackGdf => ({
  eventoId: `mail-${++seq}`,
  protocolo,
  ocorridoEm: new Date().toISOString(),
  ...extra,
});

function enviadorFalso() {
  const enviados: { para: string; assunto: string; texto: string }[] = [];
  const enviador: EnviadorEmail = { enviar: vi.fn(async (m) => void enviados.push(m)) };
  return { enviador, enviados };
}

describe("e-mail a cada mudança de status", () => {
  it("enfileira na transação e envia ao autor, sem o relato", async () => {
    const protocolo = await denunciaEnviada(autora);
    await aplicarEventoGdf(db, evento(protocolo, { status: "ENCAMINHADA", orgaoSigla: "CEB-IPES", texto: "Equipe acionada." }), NOTIFICAR);

    const fila = await db.notificacaoEmail.findMany({ where: { evento: { denuncia: { protocolo } } } });
    expect(fila).toHaveLength(1);
    expect(fila[0].enviadoEm).toBeNull();

    const { enviador, enviados } = enviadorFalso();
    expect(await processarEmailsPendentes({ db, enviador })).toMatchObject({ enviados: 1, semSmtp: false });
    expect(enviados[0].para).toBe("ana@vozdf.example");
    expect(enviados[0].assunto).toBe(`[Voz DF] ${protocolo}: Encaminhada ao órgão`);
    expect(enviados[0].texto).toContain("(CEB-IPES)");
    expect(enviados[0].texto).toContain("Equipe acionada.");
    expect(enviados[0].texto).not.toContain("Dona Maria"); // relato nunca vai no e-mail

    // Já enviado: não reenvia.
    expect((await processarEmailsPendentes({ db, enviador })).enviados).toBe(0);
  });

  it("denúncia anônima não gera e-mail; evento repetido não duplica", async () => {
    const anonima = await denunciaEnviada(null);
    await aplicarEventoGdf(db, evento(anonima, { status: "EM_ANALISE" }), NOTIFICAR);
    expect(await db.notificacaoEmail.count({ where: { evento: { denuncia: { protocolo: anonima } } } })).toBe(0);

    const protocolo = await denunciaEnviada(autora);
    const e = evento(protocolo, { status: "EM_ANALISE" });
    await aplicarEventoGdf(db, e, NOTIFICAR);
    await aplicarEventoGdf(db, e, NOTIFICAR); // duplicado
    expect(await db.notificacaoEmail.count({ where: { evento: { denuncia: { protocolo } } } })).toBe(1);
  });

  it("respeita quem desativou as notificações (antes e depois de enfileirar)", async () => {
    const protocolo = await denunciaEnviada(autora);
    await aplicarEventoGdf(db, evento(protocolo, { status: "EM_ANALISE" }), NOTIFICAR);
    await db.usuario.update({ where: { id: autora }, data: { notificarPorEmail: false } });

    const { enviador, enviados } = enviadorFalso();
    await processarEmailsPendentes({ db, enviador });
    expect(enviados.find((m) => m.assunto.includes(protocolo))).toBeUndefined();

    await aplicarEventoGdf(db, evento(protocolo, { status: "ENCAMINHADA", orgaoSigla: "CEB-IPES" }), NOTIFICAR);
    expect(await db.notificacaoEmail.count({ where: { evento: { denuncia: { protocolo }, statusPara: "ENCAMINHADA" } } })).toBe(0);
    await db.usuario.update({ where: { id: autora }, data: { notificarPorEmail: true } });
  });

  it("falha de SMTP fica na fila para nova tentativa; sem SMTP nada é enviado", async () => {
    const protocolo = await denunciaEnviada(autora);
    await aplicarEventoGdf(db, evento(protocolo, { status: "EM_ANALISE" }), NOTIFICAR);

    expect(await processarEmailsPendentes({ db, enviador: null })).toMatchObject({ semSmtp: true, enviados: 0 });

    const quebrado: EnviadorEmail = { enviar: () => Promise.reject(new Error("ECONNREFUSED ana@vozdf.example")) };
    await processarEmailsPendentes({ db, enviador: quebrado });
    const n = await db.notificacaoEmail.findFirstOrThrow({ where: { evento: { denuncia: { protocolo } } } });
    expect(n).toMatchObject({ enviadoEm: null, tentativas: 1, ultimoErro: "Error" }); // sem o endereço no log

    const { enviador, enviados } = enviadorFalso();
    await processarEmailsPendentes({ db, enviador });
    expect(enviados.some((m) => m.assunto.includes(protocolo))).toBe(true);
  });
});
