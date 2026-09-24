"use client";

// Mapa público (Leaflet + OSM). Importado via next/dynamic com ssr: false (usa window).
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { PontoPublico } from "@/server/denuncias/mapa";
import { COR_STATUS } from "./cores-status";

export default function MapaPublico({ pontos }: { pontos: PontoPublico[] }) {
  return (
    <MapContainer
      center={[-15.7939, -47.8828]}
      zoom={10}
      scrollWheelZoom
      className="h-[28rem] w-full rounded-xl border border-slate-300 sm:h-[36rem]"
      aria-label="Mapa das denúncias (localização aproximada)"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pontos.map((p) => (
        <CircleMarker
          key={p.protocolo}
          center={[p.latitude, p.longitude]}
          radius={8}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: COR_STATUS[p.status], fillOpacity: 0.9 }}
        >
          <Popup>
            <strong>{p.categoria}</strong>
            <br />
            {p.ra} · {p.statusRotulo}
            {p.totalApoios > 0 && ` · ${p.totalApoios} apoio(s)`}
            <br />
            <Link href={`/acompanhar/${p.protocolo}`}>{p.protocolo}</Link>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
