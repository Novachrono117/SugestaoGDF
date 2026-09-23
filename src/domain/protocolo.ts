// Protocolo legível da denúncia: DF-AAAA-NNNNNN.
// A sequência vem de ContadorProtocolo (incremento atômico no servidor); aqui só formatação/validação.

export const PROTOCOLO_REGEX = /^DF-(\d{4})-(\d{6})$/;
const SEQUENCIA_MAX = 999_999;

export function formatarProtocolo(ano: number, sequencia: number): string {
  if (!Number.isInteger(ano) || ano < 2000 || ano > 9999) throw new RangeError(`Ano inválido: ${ano}`);
  if (!Number.isInteger(sequencia) || sequencia < 1 || sequencia > SEQUENCIA_MAX) {
    throw new RangeError(`Sequência fora do intervalo 1–${SEQUENCIA_MAX}: ${sequencia}`);
  }
  return `DF-${ano}-${String(sequencia).padStart(6, "0")}`;
}

export function isProtocolo(value: string): boolean {
  const m = PROTOCOLO_REGEX.exec(value);
  return m !== null && Number(m[2]) >= 1;
}

/** Normaliza o que a pessoa digita na busca ("df-2026-123" → "DF-2026-000123"). */
export function normalizarProtocolo(input: string): string | null {
  const m = /^\s*df-?(\d{4})-?(\d{1,6})\s*$/i.exec(input);
  if (!m) return null;
  const sequencia = Number(m[2]);
  return sequencia >= 1 ? formatarProtocolo(Number(m[1]), sequencia) : null;
}
