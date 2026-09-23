"use client";

// Mapa (Leaflet + OpenStreetMap) para marcar o local do problema. Importado via next/dynamic
// com ssr: false (o Leaflet acessa window). CircleMarker evita os ícones PNG do Leaflet,
// que quebram com bundlers.
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
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
  return (
    <MapContainer
      center={[CENTRO_DF.lat, CENTRO_DF.lng]}
      zoom={11}
      scrollWheelZoom
      className="h-72 w-full rounded-xl border border-slate-300 sm:h-96"
      aria-label="Mapa: toque no local do problema"
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
  );
}
