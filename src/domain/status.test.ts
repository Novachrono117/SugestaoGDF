import { describe, expect, it } from "vitest";
import { ESTADOS_FINAIS, STATUS, proximosStatus, validarTransicao, type Status } from "./status";

describe("validarTransicao", () => {
  it("permite o caminho feliz completo", () => {
    const caminho: Array<[Status, Status, "SISTEMA" | "GDF", object?]> = [
      ["RECEBIDA", "ENVIADA_GDF", "SISTEMA"],
      ["ENVIADA_GDF", "EM_ANALISE", "GDF"],
      ["EM_ANALISE", "ENCAMINHADA", "GDF", { orgaoSigla: "CEB-IPES" }],
      ["ENCAMINHADA", "EM_EXECUCAO", "GDF"],
      ["EM_EXECUCAO", "RESOLVIDA", "GDF", { texto: "Lâmpada trocada." }],
    ];
    for (const [de, para, ator, extra] of caminho) {
      expect(validarTransicao({ de, para, ator, ...extra })).toEqual({ ok: true });
    }
  });

  it("permite que o órgão devolva para análise", () => {
    expect(validarTransicao({ de: "ENCAMINHADA", para: "EM_ANALISE", ator: "GDF" })).toEqual({ ok: true });
  });

  it("rejeita pular etapas", () => {
    const r = validarTransicao({ de: "RECEBIDA", para: "RESOLVIDA", ator: "GDF", texto: "x" });
    expect(r).toMatchObject({ ok: false, code: "TRANSICAO_INVALIDA" });
  });

  it("rejeita ator errado", () => {
    expect(validarTransicao({ de: "RECEBIDA", para: "ENVIADA_GDF", ator: "GDF" })).toMatchObject({
      ok: false,
      code: "ATOR_NAO_AUTORIZADO",
    });
    expect(
      validarTransicao({ de: "ENVIADA_GDF", para: "ENCAMINHADA", ator: "CIDADAO", orgaoSigla: "SLU" }),
    ).toMatchObject({ ok: false, code: "ATOR_NAO_AUTORIZADO" });
  });

  it("exige órgão ao encaminhar", () => {
    for (const orgaoSigla of [undefined, null, "", "  "]) {
      expect(validarTransicao({ de: "EM_ANALISE", para: "ENCAMINHADA", ator: "GDF", orgaoSigla })).toMatchObject({
        ok: false,
        code: "ORGAO_OBRIGATORIO",
      });
    }
  });

  it.each(["NAO_PROCEDENTE", "DUPLICADA"] as const)("exige texto em %s", (para) => {
    expect(validarTransicao({ de: "EM_ANALISE", para, ator: "GDF", texto: " " })).toMatchObject({
      ok: false,
      code: "TEXTO_OBRIGATORIO",
    });
  });

  it("exige texto ao resolver", () => {
    expect(validarTransicao({ de: "EM_EXECUCAO", para: "RESOLVIDA", ator: "GDF" })).toMatchObject({
      ok: false,
      code: "TEXTO_OBRIGATORIO",
    });
  });

  it("estados finais não têm saída", () => {
    for (const final of ESTADOS_FINAIS) {
      expect(proximosStatus(final)).toEqual([]);
      for (const para of STATUS) {
        for (const ator of ["GDF", "CIDADAO", "SISTEMA"] as const) {
          expect(validarTransicao({ de: final, para, ator, texto: "x", orgaoSigla: "SLU" }).ok).toBe(false);
        }
      }
    }
  });

  it("só o cidadão reabre uma denúncia resolvida, e com justificativa", () => {
    expect(validarTransicao({ de: "RESOLVIDA", para: "REABERTA", ator: "CIDADAO", texto: "Continua apagado." })).toEqual({ ok: true });
    expect(validarTransicao({ de: "RESOLVIDA", para: "REABERTA", ator: "GDF", texto: "x" })).toMatchObject({
      code: "ATOR_NAO_AUTORIZADO",
    });
    expect(validarTransicao({ de: "RESOLVIDA", para: "REABERTA", ator: "CIDADAO", texto: " " })).toMatchObject({
      code: "TEXTO_OBRIGATORIO",
    });
  });

  it("depois de reaberta, o GDF decide de novo", () => {
    expect(validarTransicao({ de: "REABERTA", para: "EM_ANALISE", ator: "GDF" })).toEqual({ ok: true });
    expect(validarTransicao({ de: "REABERTA", para: "ENCAMINHADA", ator: "GDF", orgaoSigla: "CEB-IPES" })).toEqual({ ok: true });
    expect(validarTransicao({ de: "REABERTA", para: "RESOLVIDA", ator: "GDF", texto: "x" })).toMatchObject({
      code: "TRANSICAO_INVALIDA",
    });
  });

  it("nenhuma transição leva de volta a RECEBIDA", () => {
    for (const de of STATUS) expect(proximosStatus(de)).not.toContain("RECEBIDA");
  });
});
