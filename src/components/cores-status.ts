// Cores por status para o mapa e a legenda (hex: o Leaflet não usa classes do Tailwind).
import type { Status } from "@/domain/status";

export const COR_STATUS: Record<Status, string> = {
  RECEBIDA: "#64748b",
  ENVIADA_GDF: "#0284c7",
  EM_ANALISE: "#d97706",
  ENCAMINHADA: "#4f46e5",
  EM_EXECUCAO: "#7c3aed",
  RESOLVIDA: "#059669",
  REABERTA: "#ea580c",
  NAO_PROCEDENTE: "#e11d48",
  DUPLICADA: "#71717a",
};
