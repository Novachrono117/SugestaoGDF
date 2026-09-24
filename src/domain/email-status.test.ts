import { describe, expect, it } from "vitest";
import { montarEmailMudancaStatus } from "./email-status";

describe("montarEmailMudancaStatus", () => {
  it("encaminhada: status, órgão, mensagem e link", () => {
    const e = montarEmailMudancaStatus({
      protocolo: "DF-2026-000123",
      status: "ENCAMINHADA",
      orgao: { sigla: "CEB-IPES", nome: "CEB Iluminação Pública e Serviços" },
      mensagemGdf: "Encaminhada à equipe de manutenção.",
      appUrl: "http://voz.test/",
    });
    expect(e.assunto).toBe("[Voz DF] DF-2026-000123: Encaminhada ao órgão");
    expect(e.texto).toContain("Órgão responsável: CEB Iluminação Pública e Serviços (CEB-IPES)");
    expect(e.texto).toContain('Mensagem do GDF: "Encaminhada à equipe de manutenção."');
    expect(e.texto).toContain("http://voz.test/acompanhar/DF-2026-000123");
    expect(e.texto).toContain("http://voz.test/minha-conta");
  });

  it("resolvida: convida a confirmar ou contestar", () => {
    const e = montarEmailMudancaStatus({ protocolo: "DF-2026-000001", status: "RESOLVIDA", appUrl: "http://voz.test" });
    expect(e.texto).toContain("O problema foi mesmo resolvido? Confirme ou conteste em até 30 dias");
    expect(e.texto).not.toContain("Órgão responsável");
    expect(e.texto).not.toContain("Mensagem do GDF");
  });
});
