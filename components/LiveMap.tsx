'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Custom Bus Icon
const busSvgString = `
<div style="background: linear-gradient(135deg, #6366f1, #4338ca); color: white; padding: 10px; border-radius: 50%; box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.5); display: flex; align-items: center; justify-content: center; border: 3px solid white; transform: rotate(0deg); transition: transform 0.3s; width: 44px; height: 44px; box-sizing: border-box;">
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path>
    <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path>
    <circle cx="7" cy="18" r="2"></circle><circle cx="17" cy="18" r="2"></circle>
  </svg>
</div>`;

const BusIcon = L.divIcon({
  html: busSvgString,
  className: 'custom-bus-marker', // Leave empty to avoid default leaflet styling
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -22]
});

L.Marker.prototype.options.icon = BusIcon;

interface LiveMapProps {
  locations: { id: string; lat: number; lng: number; label: string }[];
  center?: [number, number];
  zoom?: number;
}

function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export default function LiveMap({ locations, center = [0, 0], zoom = 13 }: LiveMapProps) {
  if (typeof window === 'undefined') return <div className="h-[400px] w-full bg-slate-100 animate-pulse rounded-xl" />;

  const mapCenter = locations.length > 0 ? [locations[0].lat, locations[0].lng] as [number, number] : center;

  return (
    <div className="h-[400px] w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <MapContainer center={mapCenter} zoom={zoom} style={{ height: '100%', width: '100%' }}>
        <MapUpdater center={mapCenter} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locations.map((loc) => (
          <Marker key={loc.id} position={[loc.lat, loc.lng]}>
            <Popup>{loc.label}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
