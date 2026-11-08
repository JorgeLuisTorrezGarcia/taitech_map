import RBush from 'rbush';
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';
import type {
  Coordinates,
  DatasetStats,
  NearResult,
  RouteFeatureProperties,
  RouteItem,
  SpatialSegment,
  TripOption,
} from '../types.ts';
import {
  getRouteColor,
  haversineDistance,
  normalizeRouteName,
  projectPointOnSegment,
} from '../utils/geo.ts';
import { calculateTrips } from '../utils/routing.ts';
import { SpatialRouteIndex } from '../utils/spatial-index.ts';

// Worker state
let spatialIndex = new SpatialRouteIndex();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tileIndex: any = null;
let currentRoutes: RouteItem[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentGeoJSON: any = null;

export interface InitDataPayload {
  geoJsonText?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoJsonObject?: any;
  fileName?: string;
  fileSizeBytes?: number;
}

export function processGeoJson(payload: InitDataPayload): {
  routes: RouteItem[];
  stats: DatasetStats;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoJson: any;
} {
  const startTime = performance.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let gj: any;

  if (payload.geoJsonObject) {
    gj = payload.geoJsonObject;
  } else if (payload.geoJsonText) {
    gj = JSON.parse(payload.geoJsonText);
  } else {
    throw new Error('No GeoJSON content provided');
  }

  const features = gj.features || [];
  const routes: RouteItem[] = [];
  let totalSegments = 0;
  let totalDistanceMeters = 0;

  // Group or process features
  for (let idx = 0; idx < features.length; idx++) {
    const f = features[idx];
    if (!f || !f.geometry) continue;

    const props: RouteFeatureProperties = f.properties || {};
    const geom = f.geometry;
    const label = normalizeRouteName(props.nombre || props.name || props.linea || `Línea ${idx + 1}`);
    const direction = props.sentido === 2 ? 2 : 1;
    const color = props.color || getRouteColor(label, direction);
    const dirLabel = direction === 2 ? 'Vuelta (S2)' : 'Ida (S1)';

    let coordLists: Coordinates[][] = [];
    if (geom.type === 'MultiLineString') {
      coordLists = geom.coordinates;
    } else if (geom.type === 'LineString') {
      coordLists = [geom.coordinates];
    }

    for (let partIdx = 0; partIdx < coordLists.length; partIdx++) {
      const coords = coordLists[partIdx];
      if (!coords || coords.length < 2) continue;

      let routeDist = 0;
      let minX = coords[0][0];
      let maxX = coords[0][0];
      let minY = coords[0][1];
      let maxY = coords[0][1];

      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        routeDist += haversineDistance(p1[0], p1[1], p2[0], p2[1]);
        minX = Math.min(minX, p2[0]);
        maxX = Math.max(maxX, p2[0]);
        minY = Math.min(minY, p2[1]);
        maxY = Math.max(maxY, p2[1]);
        totalSegments++;
      }

      totalDistanceMeters += routeDist;
      const routeId = `${label}_S${direction}_${partIdx}`;

      routes.push({
        id: routeId,
        label,
        direction,
        directionLabel: dirLabel,
        color,
        coordinates: coords,
        totalDistanceMeters: routeDist,
        bbox: [minX, minY, maxX, maxY],
        rawProperties: props,
      });
    }
  }

  // Build GeoJSON with normalized properties for geojson-vt
  const cleanGeoJSON = {
    type: 'FeatureCollection',
    features: routes.map((r) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: r.coordinates,
      },
      properties: {
        id: r.id,
        label: r.label,
        direction: r.direction,
        directionLabel: r.directionLabel,
        color: r.color,
        distanceMeters: Math.round(r.totalDistanceMeters),
      },
    })),
  };

  // Build RBush index
  spatialIndex = new SpatialRouteIndex();
  spatialIndex.buildIndex(routes);

  // Build geojson-vt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tileIndex = new (geojsonvt as any)(cleanGeoJSON, {
    maxZoom: 16,
    indexMaxZoom: 14,
    tolerance: 3,
    extent: 4096,
    buffer: 64,
  });

  currentRoutes = routes;
  currentGeoJSON = cleanGeoJSON;

  const durationMs = performance.now() - startTime;
  const fileSizeBytes =
    payload.fileSizeBytes || (payload.geoJsonText ? payload.geoJsonText.length : 0);

  const stats: DatasetStats = {
    featureCount: features.length,
    routeCount: routes.length,
    segmentCount: totalSegments,
    totalDistanceKm: Math.round(totalDistanceMeters / 1000),
    fileSizeBytes,
    fileName: payload.fileName || 'rutas_micro_scz.geojson',
    loadTimeMs: Math.round(durationMs),
  };

  return { routes, stats, geoJson: cleanGeoJSON };
}

// Check if running inside Worker
const isWorker =
  typeof self !== 'undefined' &&
  typeof (self as any).importScripts === 'function';

if (isWorker) {
  (self as any).onmessage = (e: MessageEvent) => {
    const { id, type, payload } = e.data;

    try {
      if (type === 'INIT_DATA') {
        const { routes, stats, geoJson } = processGeoJson(payload);
        // Pass summary of routes (to minimize transfer overhead)
        const summary = routes.map((r) => ({
          id: r.id,
          label: r.label,
          direction: r.direction,
          directionLabel: r.directionLabel,
          color: r.color,
          totalDistanceMeters: r.totalDistanceMeters,
          bbox: r.bbox,
        }));

        (self as any).postMessage({
          id,
          type: 'INIT_DATA_COMPLETE',
          success: true,
          routes: summary,
          stats,
          geoJson,
        });
      } else if (type === 'QUERY_NEAR') {
        const { point, radiusMeters } = payload;
        const results = spatialIndex.findRoutesNearPoint(point, radiusMeters);
        (self as any).postMessage({
          id,
          type: 'QUERY_NEAR_COMPLETE',
          success: true,
          results,
        });
      } else if (type === 'QUERY_PLAN') {
        const { pointA, pointB, searchRadiusMeters, maxTransferMeters, enforceDirection } =
          payload;
        const trips = calculateTrips({
          pointA,
          pointB,
          spatialIndex,
          searchRadiusMeters,
          maxTransferMeters,
          enforceDirection,
        });
        (self as any).postMessage({
          id,
          type: 'QUERY_PLAN_COMPLETE',
          success: true,
          trips,
        });
      } else if (type === 'GET_TILE') {
        const { z, x, y } = payload;
        if (!tileIndex) {
          (self as any).postMessage({ id, type: 'TILE_COMPLETE', success: false });
          return;
        }

        const tile = tileIndex.getTile(z, x, y);
        if (!tile) {
          (self as any).postMessage({ id, type: 'TILE_COMPLETE', success: true, buffer: null });
          return;
        }

        const pbfBuffer = vtpbf.fromGeojsonVt({ routes: tile });
        (self as any).postMessage(
          {
            id,
            type: 'TILE_COMPLETE',
            success: true,
            buffer: pbfBuffer.buffer,
          },
          [pbfBuffer.buffer]
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      (self as any).postMessage({
        id,
        type: 'ERROR',
        success: false,
        error: message,
      });
    }
  };
}
