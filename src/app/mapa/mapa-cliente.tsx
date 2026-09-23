"use client";

import dynamic from "next/dynamic";
import type { PontoPublico } from "@/server/denuncias/mapa";

// ssr: false só é permitido dentro de um Client Component.
const MapaPublico = dynamic(() => import("@/components/mapa-publico"), {
  ssr: false,
  loading: () => <div className="h-[28rem] w-full animate-pulse rounded-xl bg-slate-200 sm:h-[36rem]" aria-hidden />,
});

export function MapaCliente({ pontos }: { pontos: PontoPublico[] }) {
  return <MapaPublico pontos={pontos} />;
}
