"use client";

// Mapa (Leaflet + OpenStreetMap) para marcar o local do problema. Importado via next/dynamic
// com ssr: false (o Leaflet acessa window). CircleMarker evita os ícones PNG do Leaflet,
// que quebram com bundlers.
import "leaflet/dist/leaflet.css";
import type { Map as MapaLeaflet } from "leaflet";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

export type Ponto = { lat: number; lng: number };

const CENTRO_DF: Ponto = { lat: -15.7939, lng: -47.8828 };

function CapturaClique({ onSelecionar }: { onSelecionar: (p: Ponto) => void }) {
  useMapEvents({ click: (e) => onSelecionar({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Centralizar({ ponto }: { ponto: Ponto | null }) {
  const map = useMap();
  useEffect(() => {
    if (ponto) map.setView([ponto.lat, ponto.lng], Math.max(map.getZoom(), 16));
  }, [map, ponto]);
  return null;
}

export default function MapaSeletor({
  ponto,
  onSelecionar,
  centralizarEm,
}: {
  ponto: Ponto | null;
  onSelecionar: (p: Ponto) => void;
  /** Muda quando o ponto vem de fora (ex.: GPS) para recentralizar o mapa. */
  centralizarEm: Ponto | null;
}) {
  const [mapa, setMapa] = useState<MapaLeaflet | null>(null);

  function marcarCentro() {
    if (!mapa) return;
    const c = mapa.getCenter();
    onSelecionar({ lat: c.lat, lng: c.lng });
  }

  // Sem toque/mouse (teclado, leitor de tela): as setas movem o mapa (teclado nativo do Leaflet)
  // e o botão marca o centro. A mira aparece enquanto o mapa ou o botão estão em foco.
  return (
    <div className="group flex flex-col gap-2">
      <div className="relative">
        <MapContainer
          ref={setMapa}
          center={[CENTRO_DF.lat, CENTRO_DF.lng]}
          zoom={11}
          scrollWheelZoom
          className="h-72 w-full rounded-xl border border-slate-300 sm:h-96"
          aria-label="Mapa do local do problema. Setas movem o mapa; + e − mudam o zoom."
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CapturaClique onSelecionar={onSelecionar} />
          <Centralizar ponto={centralizarEm} />
          {ponto && (
            <CircleMarker
              center={[ponto.lat, ponto.lng]}
              radius={10}
              pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.8, weight: 3 }}
            />
          )}
        </MapContainer>
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-[500] hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 group-focus-within:block"
        >
          <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-slate-900" />
          <span className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-slate-900" />
        </span>
      </div>
      <button
        type="button"
        onClick={marcarCentro}
        className="self-start text-sm font-semibold text-blue-800 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        Marcar o centro do mapa
      </button>
    </div>
  );
}
