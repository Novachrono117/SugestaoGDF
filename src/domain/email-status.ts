// Texto do e-mail de mudança de status. Conteúdo mínimo (LGPD): protocolo, status, órgão e a
// mensagem do GDF — nunca o relato do cidadão, fotos ou localização.
import { PRAZO_CONTESTACAO_DIAS, ROTULO_STATUS, type Status } from "./status";

export type DadosEmailStatus = {
  protocolo: string;
  status: Status;
  orgao?: { sigla: string; nome: string } | null;
  mensagemGdf?: string | null;
  appUrl: string;
};

export function montarEmailMudancaStatus(d: DadosEmailStatus): { assunto: string; texto: string } {
  const base = d.appUrl.replace(/\/+$/, "");
  const link = `${base}/acompanhar/${d.protocolo}`;
  const rotulo = ROTULO_STATUS[d.status];

  const linhas = [
    "Olá!",
    "",
    `Sua denúncia ${d.protocolo} foi atualizada pelo GDF.`,
    "",
    `Novo status: ${rotulo}`,
  ];
  if (d.orgao) linhas.push(`Órgão responsável: ${d.orgao.nome} (${d.orgao.sigla})`);
  if (d.mensagemGdf?.trim()) linhas.push(`Mensagem do GDF: "${d.mensagemGdf.trim()}"`);
  linhas.push("");
  if (d.status === "RESOLVIDA") {
    linhas.push(
      `O problema foi mesmo resolvido? Confirme ou conteste em até ${PRAZO_CONTESTACAO_DIAS} dias — se não foi, a denúncia volta para o GDF:`,
    );
  } else {
    linhas.push("Acompanhe o andamento:");
  }
  linhas.push(link, "", "—", "Voz DF (projeto acadêmico, não é um serviço oficial do GDF).");
  linhas.push("Você recebe este e-mail porque fez esta denúncia com sua conta.");
  linhas.push(`Para não receber mais: ${base}/minha-conta`);

  return { assunto: `[Voz DF] ${d.protocolo}: ${rotulo}`, texto: linhas.join("\n") };
}
