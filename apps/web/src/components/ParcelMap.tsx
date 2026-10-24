import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Parcel } from '../../../../packages/contracts/src/schemas.ts';

export default function ParcelMap({ parcels }: { parcels: Parcel[] }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#efebdf' },
          },
        ],
      },
      center: parcels[0]?.location.coordinates ?? [-80.65, -4.84],
      zoom: 12,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    for (const parcel of parcels) {
      const text = document.createElement('span');
      text.textContent = parcel.name;
      new maplibregl.Marker({ color: '#1f5c43' })
        .setLngLat(parcel.location.coordinates)
        .setPopup(new maplibregl.Popup().setDOMContent(text))
        .addTo(map);
    }
    return () => map.remove();
  }, [parcels]);
  return (
    <div
      className="ds-map-canvas"
      ref={container}
      aria-label="Mapa de ubicación de parcelas"
    />
  );
}
