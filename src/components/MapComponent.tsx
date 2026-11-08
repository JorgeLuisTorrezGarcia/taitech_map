import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Coordinates, POIItem, RouteItem, TripOption } from '../types.ts';

// Configure MapLibre to use local worker URL
if (typeof window !== 'undefined') {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
}

export type MapStyleKey = 'liberty' | 'bright' | 'dark' | 'positron';

const MAP_STYLES: Record<MapStyleKey, { name: string; url: string }> = {
  liberty: {
    name: 'Calles Clásico',
    url: 'https://tiles.openfreemap.org/styles/liberty',
  },
  bright: {
    name: 'Claro Brillante',
    url: 'https://tiles.openfreemap.org/styles/bright',
  },
  dark: {
    name: 'Modo Oscuro',
    url: 'https://tiles.openfreemap.org/styles/dark',
  },
  positron: {
    name: 'Carto Positron',
    url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
};

interface MapComponentProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoJsonData: any;
  visibleRouteIds: Set<string>;
  highlightedRouteId: string | null;
  pointP: Coordinates | null;
  pointA: Coordinates | null;
  pointB: Coordinates | null;
  activeTrip: TripOption | null;
  selectedPOI: POIItem | null;
  allPOIs?: POIItem[];
  activeMode: 'copilot' | 'lines' | 'near' | 'route' | 'places' | 'dataset';
  routeTarget: 'A' | 'B';
  onMapClickPoint: (coords: Coordinates) => void;
  onSelectRoute: (routeId: string) => void;
  onSelectPOI: (poi: POIItem) => void;
  searchRadiusMeters?: number;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  geoJsonData,
  visibleRouteIds,
  highlightedRouteId,
  pointP,
  pointA,
  pointB,
  activeTrip,
  selectedPOI,
  allPOIs = [],
  activeMode,
  onMapClickPoint,
  onSelectRoute,
  onSelectPOI,
  searchRadiusMeters = 500,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<MapStyleKey>('liberty');

  // Callback refs to prevent stale closures in MapLibre event listeners
  const onMapClickPointRef = useRef(onMapClickPoint);
  onMapClickPointRef.current = onMapClickPoint;
  const onSelectRouteRef = useRef(onSelectRoute);
  onSelectRouteRef.current = onSelectRoute;
  const onSelectPOIRef = useRef(onSelectPOI);
  onSelectPOIRef.current = onSelectPOI;

  // Markers refs for smooth updates without tearing down the map
  const markerARef = useRef<maplibregl.Marker | null>(null);
  const markerBRef = useRef<maplibregl.Marker | null>(null);
  const markerPRef = useRef<maplibregl.Marker | null>(null);
  const markerPOIRef = useRef<maplibregl.Marker | null>(null);

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default center: Plaza 24 de Septiembre, Santa Cruz de la Sierra
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[currentStyle].url,
      center: [-63.1821, -17.7833],
      zoom: 12.5,
      maxZoom: 19,
      minZoom: 9,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    );
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      'top-right'
    );

    map.on('load', () => {
      // 1. Generate directional arrow icon
      const canvas = document.createElement('canvas');
      canvas.width = 24;
      canvas.height = 24;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(4, 3);
        ctx.lineTo(21, 12);
        ctx.lineTo(4, 21);
        ctx.lineTo(9, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const imgData = ctx.getImageData(0, 0, 24, 24);
        map.addImage('arrow-dir', imgData);
      }

      // 2. Add Sources
      map.addSource('all-routes', {
        type: 'geojson',
        data: geoJsonData || { type: 'FeatureCollection', features: [] },
      });

      map.addSource('highlighted-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('trip-segments', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('radius-circle', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // 3. Add Layers

      // Radius circle layer (visualizes search radius around point P)
      map.addLayer({
        id: 'radius-circle-fill',
        type: 'fill',
        source: 'radius-circle',
        paint: {
          'fill-color': '#0284c7',
          'fill-opacity': 0.12,
        },
      });

      map.addLayer({
        id: 'radius-circle-line',
        type: 'line',
        source: 'radius-circle',
        paint: {
          'line-color': '#0284c7',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });

      // Base Routes Line Layer
      map.addLayer({
        id: 'routes-line-base',
        type: 'line',
        source: 'all-routes',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            2,
            14,
            3.5,
            18,
            6,
          ],
          'line-opacity': 0.8,
        },
      });

      // Directional Arrows
      map.addLayer({
        id: 'routes-arrows',
        type: 'symbol',
        source: 'all-routes',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 90,
          'icon-image': 'arrow-dir',
          'icon-size': 0.5,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      // Highlighted Route Glow Outer
      map.addLayer({
        id: 'routes-highlight-halo',
        type: 'line',
        source: 'highlighted-route',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': 10,
          'line-opacity': 0.9,
        },
      });

      // Highlighted Route Inner Solid
      map.addLayer({
        id: 'routes-highlight-core',
        type: 'line',
        source: 'highlighted-route',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 5.5,
          'line-opacity': 1.0,
        },
      });

      // Trip Plan: Bus ride segments
      map.addLayer({
        id: 'trip-bus-halo',
        type: 'line',
        source: 'trip-segments',
        filter: ['==', ['get', 'isWalk'], false],
        paint: {
          'line-color': '#ffffff',
          'line-width': 9,
          'line-opacity': 0.85,
        },
      });

      map.addLayer({
        id: 'trip-bus-line',
        type: 'line',
        source: 'trip-segments',
        filter: ['==', ['get', 'isWalk'], false],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 6,
          'line-opacity': 1,
        },
      });

      map.addLayer({
        id: 'trip-bus-arrows',
        type: 'symbol',
        source: 'trip-segments',
        filter: ['==', ['get', 'isWalk'], false],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 70,
          'icon-image': 'arrow-dir',
          'icon-size': 0.6,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      // Trip Plan: Walking segments (dashed)
      map.addLayer({
        id: 'trip-walk-line',
        type: 'line',
        source: 'trip-segments',
        filter: ['==', ['get', 'isWalk'], true],
        paint: {
          'line-color': '#0f172a',
          'line-width': 4.5,
          'line-dasharray': [1.5, 1.5],
        },
      });

      // Click on route line to inspect
      map.on('click', 'routes-line-base', (e) => {
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          if (props && props.id) {
            onSelectRouteRef.current(props.id);
          }
        }
      });

      // Hover cursors
      map.on('mouseenter', 'routes-line-base', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'routes-line-base', () => {
        map.getCanvas().style.cursor = '';
      });

      setMapLoaded(true);

      // Auto-fit to routes on first load
      if (geoJsonData && geoJsonData.features && geoJsonData.features.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const f of geoJsonData.features) {
          const coords = f.geometry?.coordinates || [];
          for (const c of coords) {
            if (c[0] < minX) minX = c[0];
            if (c[0] > maxX) maxX = c[0];
            if (c[1] < minY) minY = c[1];
            if (c[1] > maxY) maxY = c[1];
          }
        }
        if (minX !== Infinity) {
          map.fitBounds(
            [
              [minX, minY],
              [maxX, maxY],
            ],
            { padding: { top: 60, bottom: 60, left: 420, right: 60 }, duration: 1000 }
          );
        }
      }
    });

    // Map Click handler for picking points
    map.on('click', (e) => {
      // If clicked directly on a line, line click handler runs; else set point
      const clickedCoords: Coordinates = [e.lngLat.lng, e.lngLat.lat];
      onMapClickPointRef.current(clickedCoords);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [currentStyle]);

  // Update GeoJSON source when data changes
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const source = mapRef.current.getSource('all-routes') as maplibregl.GeoJSONSource;
    if (source && geoJsonData) {
      source.setData(geoJsonData);
    }
  }, [geoJsonData, mapLoaded]);

  // Filter visible routes on the map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    if (visibleRouteIds.size === 0) {
      map.setFilter('routes-line-base', ['==', ['get', 'id'], '__NONE__'] as any);
      map.setFilter('routes-arrows', ['==', ['get', 'id'], '__NONE__'] as any);
    } else {
      const filterExpr: any = [
        'in',
        ['get', 'id'],
        ['literal', Array.from(visibleRouteIds)],
      ];
      map.setFilter('routes-line-base', filterExpr);
      map.setFilter('routes-arrows', filterExpr);
    }
  }, [visibleRouteIds, mapLoaded]);

  // Update highlighted route and zoom to it
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const source = map.getSource('highlighted-route') as maplibregl.GeoJSONSource;
    if (!source) return;

    // Do NOT draw highlighted route if it is not in visibleRouteIds
    if (
      !highlightedRouteId ||
      !visibleRouteIds.has(highlightedRouteId) ||
      !geoJsonData ||
      !geoJsonData.features
    ) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const feature = geoJsonData.features.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (f: any) => f.properties?.id === highlightedRouteId
    );

    if (feature && feature.geometry?.coordinates) {
      source.setData({
        type: 'FeatureCollection',
        features: [feature],
      });

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of feature.geometry.coordinates) {
        if (c[0] < minX) minX = c[0];
        if (c[0] > maxX) maxX = c[0];
        if (c[1] < minY) minY = c[1];
        if (c[1] > maxY) maxY = c[1];
      }
      if (minX !== Infinity) {
        map.fitBounds(
          [
            [minX, minY],
            [maxX, maxY],
          ],
          {
            padding: { top: 80, bottom: 80, left: window.innerWidth > 768 ? 420 : 40, right: 40 },
            maxZoom: 15,
            duration: 800,
          }
        );
      }
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [highlightedRouteId, visibleRouteIds, geoJsonData, mapLoaded]);

  // Update Trip segments on the map and fit bounds
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const source = map.getSource('trip-segments') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (!activeTrip) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const features: any[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const expandBbox = (coords: Coordinates[]) => {
      for (const c of coords) {
        if (c[0] < minX) minX = c[0];
        if (c[0] > maxX) maxX = c[0];
        if (c[1] < minY) minY = c[1];
        if (c[1] > maxY) maxY = c[1];
      }
    };

    // Add walking segments
    activeTrip.walkSegments.forEach((w, idx) => {
      expandBbox([w.from, w.to]);
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [w.from, w.to],
        },
        properties: {
          isWalk: true,
          color: '#0f172a',
          id: `walk-${idx}`,
        },
      });
    });

    // Add transit legs
    activeTrip.legs.forEach((leg, idx) => {
      expandBbox(leg.pathCoordinates);
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: leg.pathCoordinates,
        },
        properties: {
          isWalk: false,
          color: leg.color,
          id: `leg-${idx}`,
        },
      });
    });

    source.setData({
      type: 'FeatureCollection',
      features,
    });

    if (minX !== Infinity) {
      map.fitBounds(
        [
          [minX, minY],
          [maxX, maxY],
        ],
        {
          padding: { top: 80, bottom: 80, left: window.innerWidth > 768 ? 420 : 40, right: 40 },
          maxZoom: 15,
          duration: 900,
        }
      );
    }
  }, [activeTrip, mapLoaded]);

  // Update search radius circle when in "near" mode and pointP is set
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const source = mapRef.current.getSource('radius-circle') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (activeMode !== 'near' || !pointP) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // Generate circle polygon approximation (64 points)
    const [centerLon, centerLat] = pointP;
    const points: Coordinates[] = [];
    const radiusKm = searchRadiusMeters / 1000;
    const degLat = radiusKm / 111.32;
    const degLon = radiusKm / (111.32 * Math.cos((centerLat * Math.PI) / 180));

    for (let i = 0; i <= 64; i++) {
      const angle = (i * 2 * Math.PI) / 64;
      const x = centerLon + degLon * Math.cos(angle);
      const y = centerLat + degLat * Math.sin(angle);
      points.push([x, y]);
    }

    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [points],
          },
          properties: {},
        },
      ],
    });
  }, [pointP, searchRadiusMeters, activeMode, mapLoaded]);

  // Marker helper
  const createMarkerElement = (
    label: string,
    bgColor: string,
    icon: string
  ): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'group relative flex items-center justify-center cursor-pointer';
    el.innerHTML = `
      <div style="background-color: ${bgColor}" class="w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center font-bold text-white text-xs transform transition hover:scale-115">
        ${icon}
      </div>
      <div class="absolute -top-7 px-2 py-0.5 bg-slate-900/90 text-white text-[11px] font-semibold rounded-md shadow-md whitespace-nowrap pointer-events-none opacity-90">
        ${label}
      </div>
    `;
    return el;
  };

  // Sync Point A Marker
  useEffect(() => {
    if (!mapRef.current) return;
    if (pointA) {
      if (!markerARef.current) {
        const el = createMarkerElement('A - Origen', '#16a34a', 'A');
        markerARef.current = new maplibregl.Marker({ element: el })
          .setLngLat(pointA)
          .addTo(mapRef.current);
      } else {
        markerARef.current.setLngLat(pointA);
      }
    } else {
      if (markerARef.current) {
        markerARef.current.remove();
        markerARef.current = null;
      }
    }
  }, [pointA]);

  // Sync Point B Marker
  useEffect(() => {
    if (!mapRef.current) return;
    if (pointB) {
      if (!markerBRef.current) {
        const el = createMarkerElement('B - Destino', '#dc2626', 'B');
        markerBRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(pointB)
          .addTo(mapRef.current);
      } else {
        markerBRef.current.setLngLat(pointB);
      }
    } else {
      if (markerBRef.current) {
        markerBRef.current.remove();
        markerBRef.current = null;
      }
    }
  }, [pointB]);

  // Sync Point P Marker (Nearby query point)
  useEffect(() => {
    if (!mapRef.current) return;
    if (pointP) {
      if (!markerPRef.current) {
        const targetSvg = `<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`;
        const el = createMarkerElement('Punto de Consulta', '#0284c7', targetSvg);
        markerPRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(pointP)
          .addTo(mapRef.current);
      } else {
        markerPRef.current.setLngLat(pointP);
      }
    } else {
      if (markerPRef.current) {
        markerPRef.current.remove();
        markerPRef.current = null;
      }
    }
  }, [pointP]);

  // Sync selected POI Marker
  useEffect(() => {
    if (!mapRef.current) return;
    if (selectedPOI) {
      if (!markerPOIRef.current) {
        const pinSvg = `<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
        const el = createMarkerElement(selectedPOI.name, '#8b5cf6', pinSvg);
        markerPOIRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([selectedPOI.lon, selectedPOI.lat])
          .addTo(mapRef.current);
      } else {
        markerPOIRef.current.setLngLat([selectedPOI.lon, selectedPOI.lat]);
      }
    } else {
      if (markerPOIRef.current) {
        markerPOIRef.current.remove();
        markerPOIRef.current = null;
      }
    }
  }, [selectedPOI]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* MapLibre WebGL canvas container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Style Switcher pill in top left */}
      <div className="absolute top-3 left-3 z-10 hidden sm:flex items-center bg-slate-900/85 backdrop-blur-md rounded-xl p-1 border border-white/10 shadow-lg text-xs">
        {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setCurrentStyle(key)}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
              currentStyle === key
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            {MAP_STYLES[key].name}
          </button>
        ))}
      </div>
    </div>
  );
};
