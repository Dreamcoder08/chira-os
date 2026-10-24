import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { Parcel } from '../../../../packages/contracts/src/schemas.ts';
import { Icon } from './icons.tsx';

/*
 * MapLibre resolves its worker relative to the module URL it was built for,
 * and Vite never copies that file into the bundle: the map rendered an empty
 * canvas with "Worker failed to load". Pointing at the worker as an asset makes
 * the bundler emit it, and the service worker precaches it like the rest.
 */
maplibregl.setWorkerUrl(workerUrl);

/*
 * Local cartography: no tiles, no glyph server, no network.
 *
 * The pilot runs on a LAN without internet, so an orthophoto is not an option.
 * Instead the map draws what the association already owns — its parcels — over
 * a paper canvas and a client-generated kilometre grid. Labels are DOM markers
 * because a symbol layer would need a glyph server we do not have.
 */

const PAPER = '#efebdf';
const INK = '#0f1a16';
const AGAVE = '#1f5c43';
const LIME = '#b7f171';
const PARCEL_FILL = '#dce7c9';

const STEP_DEGREES = 0.009; // ~1 km of latitude

/*
 * Keep the parcels inside the space the dock and the parcel card leave free:
 * fitting the whole stage would hide the only thing worth looking at.
 */
function framePadding() {
  if (!window.matchMedia('(min-width: 1024px)').matches) {
    return { top: 56, bottom: 48, left: 56, right: 56 };
  }
  const dock = document.querySelector('.ds-dock');
  const dockHeight = dock?.getBoundingClientRect().height ?? 0;
  return {
    top: 132,
    bottom: Math.round(dockHeight) + 56,
    left: 132,
    right: 372,
  };
}

type PointGeometry = { type: 'Point'; coordinates: [number, number] };
type LineGeometry = { type: 'LineString'; coordinates: [number, number][] };
type Collection<G, P> = {
  type: 'FeatureCollection';
  features: { type: 'Feature'; geometry: G; properties: P }[];
};
type Point = Collection<PointGeometry, { id: string; name: string }>;
type LineProps = { major: boolean };
type Lines = Collection<LineGeometry, LineProps>;

function points(parcels: Parcel[]): Point {
  return {
    type: 'FeatureCollection',
    features: parcels.map((parcel) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: parcel.location.coordinates as [number, number],
      },
      properties: { id: parcel.id, name: parcel.name },
    })),
  };
}

function selectedPoint(parcel?: Parcel): Point {
  if (!parcel) return { type: 'FeatureCollection', features: [] };
  return points([parcel]);
}

function grid(parcels: Parcel[]): Lines {
  const lngs = parcels.map(
    (parcel) => parcel.location.coordinates[0] ?? -80.65,
  );
  const lats = parcels.map((parcel) => parcel.location.coordinates[1] ?? -4.84);
  const centreLat = lats.length
    ? (Math.min(...lats) + Math.max(...lats)) / 2
    : -4.84;
  const centreLng = lngs.length
    ? (Math.min(...lngs) + Math.max(...lngs)) / 2
    : -80.65;
  const stepLat = STEP_DEGREES;
  const stepLng = STEP_DEGREES / Math.cos((centreLat * Math.PI) / 180);
  // The grid has to cover the viewport at every zoom the frame allows,
  // otherwise its edge shows up as a rectangle of "no map" over the canvas.
  const span = 48;
  const minLat = (lats.length ? Math.min(...lats) : centreLat) - stepLat * span;
  const maxLat = (lats.length ? Math.max(...lats) : centreLat) + stepLat * span;
  const minLng = (lngs.length ? Math.min(...lngs) : centreLng) - stepLng * span;
  const maxLng = (lngs.length ? Math.max(...lngs) : centreLng) + stepLng * span;
  const features: {
    type: 'Feature';
    geometry: LineGeometry;
    properties: LineProps;
  }[] = [];
  let index = 0;
  for (
    let lat = Math.ceil(minLat / stepLat) * stepLat;
    lat <= maxLat;
    lat += stepLat
  ) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [minLng, lat],
          [maxLng, lat],
        ],
      },
      // Every fifth line carries more weight: a flat grid reads as graph paper.
      properties: { major: index++ % 5 === 0 },
    });
  }
  for (
    let lng = Math.ceil(minLng / stepLng) * stepLng;
    lng <= maxLng;
    lng += stepLng
  ) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [lng, minLat],
          [lng, maxLat],
        ],
      },
      properties: { major: index++ % 5 === 0 },
    });
  }
  return { type: 'FeatureCollection', features };
}

export default function ParcelMap({
  parcels,
  activeId,
}: {
  parcels: Parcel[];
  activeId?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const active = useRef<Parcel | undefined>(undefined);
  active.current = parcels.find((parcel) => parcel.id === activeId);

  useEffect(() => {
    if (!container.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          grid: { type: 'geojson', data: grid(parcels) },
          parcels: { type: 'geojson', data: points(parcels) },
          selected: { type: 'geojson', data: selectedPoint(active.current) },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': PAPER },
          },
          {
            id: 'grid-minor',
            type: 'line',
            source: 'grid',
            filter: ['==', ['get', 'major'], false],
            paint: {
              'line-color': INK,
              'line-opacity': 0.06,
              'line-width': 1,
            },
          },
          {
            id: 'grid-major',
            type: 'line',
            source: 'grid',
            filter: ['==', ['get', 'major'], true],
            paint: {
              'line-color': INK,
              'line-opacity': 0.14,
              'line-width': 1,
            },
          },
          {
            // A hectare figure in pixels would vanish at this zoom, so the
            // footprint is drawn as a visual field, not as a measurement.
            id: 'parcel-field',
            type: 'circle',
            source: 'parcels',
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                10,
                16,
                13,
                40,
                16,
                96,
              ],
              'circle-color': AGAVE,
              'circle-opacity': 0.1,
              'circle-stroke-color': AGAVE,
              'circle-stroke-opacity': 0.3,
              'circle-stroke-width': 1,
            },
          },
          {
            id: 'parcel-halo',
            type: 'circle',
            source: 'parcels',
            paint: {
              'circle-radius': 20,
              'circle-color': AGAVE,
              'circle-opacity': 0.1,
            },
          },
          {
            id: 'parcel-dot',
            type: 'circle',
            source: 'parcels',
            paint: {
              'circle-radius': 6,
              'circle-color': PARCEL_FILL,
              'circle-stroke-color': AGAVE,
              'circle-stroke-width': 2,
            },
          },
          {
            id: 'selected-ring',
            type: 'circle',
            source: 'selected',
            paint: {
              'circle-radius': 12,
              'circle-color': 'transparent',
              'circle-stroke-color': INK,
              'circle-stroke-width': 2,
            },
          },
          {
            id: 'selected-dot',
            type: 'circle',
            source: 'selected',
            paint: { 'circle-radius': 6, 'circle-color': LIME },
          },
        ],
      },
      center: (parcels[0]?.location.coordinates as [number, number]) ?? [
        -80.65, -4.84,
      ],
      zoom: 12,
      minZoom: 9,
      maxZoom: 17,
      attributionControl: false,
    });
    map.current = instance;
    instance.on('load', () => frame());

    for (const parcel of parcels) {
      const label = document.createElement('span');
      label.className = 'ds-map-label';
      label.textContent = parcel.name;
      new maplibregl.Marker({ element: label, offset: [0, -18] })
        .setLngLat(parcel.location.coordinates as [number, number])
        .addTo(instance);
    }

    // The container is hidden on a phone until the map view is opened and the
    // dock changes height; MapLibre needs an explicit resize in both cases.
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);

    return () => {
      observer.disconnect();
      map.current = null;
      instance.remove();
    };
  }, [parcels]);

  useEffect(() => {
    const source = map.current?.getSource('selected');
    if (source && 'setData' in source) {
      (source as maplibregl.GeoJSONSource).setData(
        selectedPoint(active.current),
      );
    }
  }, [activeId, parcels]);

  /*
   * A scale bar is the cheapest honest signal that this is a map and not a
   * decorated canvas: the number comes from the projection, not from taste.
   */
  const [scale, setScale] = useState<{ label: string; width: number }>({
    label: '1 km',
    width: 60,
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const steps = [100, 200, 500, 1000, 2000, 5000];
    const update = () => {
      const zoom = instance.getZoom();
      const lat = instance.getCenter().lat;
      const metresPerPixel =
        (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
      const metres =
        [...steps].reverse().find((s) => s / metresPerPixel <= 120) ??
        steps[0]!;
      setScale({
        label: metres >= 1000 ? `${metres / 1000} km` : `${metres} m`,
        width: Math.round(metres / metresPerPixel),
      });
    };
    update();
    instance.on('move', update);
    return () => {
      instance.off('move', update);
    };
  }, []);

  function frame() {
    const instance = map.current;
    if (!instance || parcels.length === 0) return;
    const lngs = parcels.map(
      (parcel) => parcel.location.coordinates[0] ?? -80.65,
    );
    const lats = parcels.map(
      (parcel) => parcel.location.coordinates[1] ?? -4.84,
    );
    const padding = framePadding();
    const spread = Math.max(
      Math.max(...lngs) - Math.min(...lngs),
      Math.max(...lats) - Math.min(...lats),
    );
    if (spread < 1e-6) {
      // One parcel has no bounding box to fit: centre it in the free area
      // instead of letting it land under the dock.
      instance.easeTo({
        center: [Math.min(...lngs), Math.min(...lats)],
        zoom: 13.4,
        padding,
        duration: 400,
      });
      return;
    }
    instance.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding, maxZoom: 15, duration: 400 },
    );
  }

  return (
    <div className="ds-map-frame">
      <div
        className="ds-map-canvas"
        ref={container}
        aria-label="Mapa de ubicación de parcelas"
      />
      <div className="ds-map-scale" aria-hidden>
        <span className="ds-map-scale-bar" style={{ width: scale.width }} />
        <span>{scale.label}</span>
      </div>
      <div className="ds-map-controls">
        <button
          type="button"
          className="ds-map-control"
          aria-label="Acercar el mapa"
          onClick={() => map.current?.zoomIn()}
        >
          <Icon name="plus" size={16} />
        </button>
        <button
          type="button"
          className="ds-map-control"
          aria-label="Alejar el mapa"
          onClick={() => map.current?.zoomOut()}
        >
          <Icon name="minus" size={16} />
        </button>
        <button
          type="button"
          className="ds-map-control"
          aria-label="Encuadrar las parcelas"
          onClick={frame}
        >
          <Icon name="parcels" size={16} />
        </button>
      </div>
    </div>
  );
}
