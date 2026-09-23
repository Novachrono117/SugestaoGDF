import { ROTULO_STATUS, type Status } from "@/domain/status";

const COR: Record<Status, string> = {
  RECEBIDA: "bg-slate-100 text-slate-800 ring-slate-300",
  ENVIADA_GDF: "bg-sky-50 text-sky-900 ring-sky-300",
  EM_ANALISE: "bg-amber-50 text-amber-900 ring-amber-300",
  ENCAMINHADA: "bg-indigo-50 text-indigo-900 ring-indigo-300",
  EM_EXECUCAO: "bg-violet-50 text-violet-900 ring-violet-300",
  RESOLVIDA: "bg-emerald-50 text-emerald-900 ring-emerald-300",
  NAO_PROCEDENTE: "bg-rose-50 text-rose-900 ring-rose-300",
  DUPLICADA: "bg-zinc-100 text-zinc-800 ring-zinc-300",
};

export function SeloStatus({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${COR[status]}`}>
      {ROTULO_STATUS[status]}
    </span>
  );
}

const formatoData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

export function formatarData(data: Date | string): string {
  return formatoData.format(new Date(data));
}
