// Máquina de estados da denúncia — fonte única das transições permitidas.
// Ver docs/ARQUITETURA.md §6. O status espelha o que o GDF informa via callback.

export const STATUS = [
  "RECEBIDA",
  "ENVIADA_GDF",
  "EM_ANALISE",
  "ENCAMINHADA",
  "EM_EXECUCAO",
  "RESOLVIDA",
  "NAO_PROCEDENTE",
  "DUPLICADA",
] as const;

export type Status = (typeof STATUS)[number];

export type Ator = "SISTEMA" | "GDF" | "CIDADAO";

export const ESTADOS_FINAIS: ReadonlySet<Status> = new Set(["RESOLVIDA", "NAO_PROCEDENTE", "DUPLICADA"]);

const TRANSICOES: Record<Status, { para: readonly Status[]; ator: Ator }> = {
  RECEBIDA: { para: ["ENVIADA_GDF"], ator: "SISTEMA" },
  ENVIADA_GDF: { para: ["EM_ANALISE", "ENCAMINHADA", "NAO_PROCEDENTE", "DUPLICADA"], ator: "GDF" },
  EM_ANALISE: { para: ["ENCAMINHADA", "NAO_PROCEDENTE", "DUPLICADA"], ator: "GDF" },
  // EM_ANALISE: o órgão devolve porque não é de sua competência.
  ENCAMINHADA: { para: ["EM_EXECUCAO", "NAO_PROCEDENTE", "EM_ANALISE"], ator: "GDF" },
  EM_EXECUCAO: { para: ["RESOLVIDA", "NAO_PROCEDENTE"], ator: "GDF" },
  RESOLVIDA: { para: [], ator: "GDF" },
  NAO_PROCEDENTE: { para: [], ator: "GDF" },
  DUPLICADA: { para: [], ator: "GDF" },
};

const EXIGE_TEXTO: ReadonlySet<Status> = new Set(["NAO_PROCEDENTE", "DUPLICADA", "RESOLVIDA"]);

export const ROTULO_STATUS: Record<Status, string> = {
  RECEBIDA: "Recebida",
  ENVIADA_GDF: "Enviada ao GDF",
  EM_ANALISE: "Em análise pelo GDF",
  ENCAMINHADA: "Encaminhada ao órgão",
  EM_EXECUCAO: "Em execução",
  RESOLVIDA: "Resolvida",
  NAO_PROCEDENTE: "Não procedente",
  DUPLICADA: "Duplicada",
};

export function isStatus(value: string): value is Status {
  return (STATUS as readonly string[]).includes(value);
}

export function proximosStatus(de: Status): readonly Status[] {
  return TRANSICOES[de].para;
}

export type TransicaoInput = {
  de: Status;
  para: Status;
  ator: Ator;
  orgaoSigla?: string | null;
  texto?: string | null;
};

export type TransicaoErro =
  | "TRANSICAO_INVALIDA"
  | "ATOR_NAO_AUTORIZADO"
  | "ORGAO_OBRIGATORIO"
  | "TEXTO_OBRIGATORIO";

export type TransicaoResultado = { ok: true } | { ok: false; code: TransicaoErro; message: string };

export function validarTransicao({ de, para, ator, orgaoSigla, texto }: TransicaoInput): TransicaoResultado {
  const regra = TRANSICOES[de];
  if (!regra.para.includes(para)) {
    return { ok: false, code: "TRANSICAO_INVALIDA", message: `Transição ${de} → ${para} não permitida.` };
  }
  if (regra.ator !== ator) {
    return { ok: false, code: "ATOR_NAO_AUTORIZADO", message: `Só ${regra.ator} pode mover a partir de ${de}.` };
  }
  if (para === "ENCAMINHADA" && !orgaoSigla?.trim()) {
    return { ok: false, code: "ORGAO_OBRIGATORIO", message: "Informe o órgão responsável ao encaminhar." };
  }
  if (EXIGE_TEXTO.has(para) && !texto?.trim()) {
    return { ok: false, code: "TEXTO_OBRIGATORIO", message: `Informe a justificativa/providência para ${para}.` };
  }
  return { ok: true };
}
