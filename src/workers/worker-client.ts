import type {
  Coordinates,
  DatasetStats,
  NearResult,
  RouteItem,
  TripOption,
} from '../types.ts';
import { processGeoJson, InitDataPayload } from './route-worker.ts';
import { calculateTrips } from '../utils/routing.ts';
import { SpatialRouteIndex } from '../utils/spatial-index.ts';
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

class RouteWorkerService {
  private worker: Worker | null = null;
  private reqIdCounter = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private isFallbackMode = false;

  // Fallback in-memory state
  private fallbackSpatialIndex: SpatialRouteIndex = new SpatialRouteIndex();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fallbackTileIndex: any = null;
  private fallbackRoutes: RouteItem[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fallbackGeoJson: any = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
        this.worker = new Worker(
          new URL('./route-worker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (e: MessageEvent) => {
          const { id, success, error, ...data } = e.data;
          const req = this.pendingRequests.get(id);
          if (req) {
            this.pendingRequests.delete(id);
            if (success) {
              req.resolve(data);
            } else {
              req.reject(new Error(error || 'Worker request failed'));
            }
          }
        };

        this.worker.onerror = (err) => {
          console.warn('Worker error, switching to synchronous in-memory engine:', err);
          this.isFallbackMode = true;
        };
      } else {
        this.isFallbackMode = true;
      }
    } catch (e) {
      console.warn('Could not launch worker, using in-memory engine:', e);
      this.isFallbackMode = true;
    }
  }

  private sendRequest<T>(type: string, payload: any): Promise<T> {
    if (this.isFallbackMode || !this.worker) {
      return this.executeFallback<T>(type, payload);
    }

    const id = ++this.reqIdCounter;
    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      try {
        this.worker!.postMessage({ id, type, payload });
      } catch (err) {
        this.pendingRequests.delete(id);
        // Fallback on transfer failure
        console.warn('Worker postMessage failed, falling back to local thread:', err);
        this.isFallbackMode = true;
        this.executeFallback<T>(type, payload).then(resolve).catch(reject);
      }
    });
  }

  private async executeFallback<T>(type: string, payload: any): Promise<T> {
    if (type === 'INIT_DATA') {
      const { routes, stats, geoJson } = processGeoJson(payload);
      this.fallbackRoutes = routes;
      this.fallbackSpatialIndex = new SpatialRouteIndex();
      this.fallbackSpatialIndex.buildIndex(routes);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.fallbackTileIndex = new (geojsonvt as any)(geoJson, {
        maxZoom: 16,
        indexMaxZoom: 14,
        tolerance: 3,
        extent: 4096,
        buffer: 64,
      });
      this.fallbackGeoJson = geoJson;

      const summary = routes.map((r) => ({
        id: r.id,
        label: r.label,
        direction: r.direction,
        directionLabel: r.directionLabel,
        color: r.color,
        totalDistanceMeters: r.totalDistanceMeters,
        bbox: r.bbox,
      }));

      return {
        routes: summary,
        stats,
        geoJson,
      } as T;
    }

    if (type === 'QUERY_NEAR') {
      const { point, radiusMeters } = payload;
      const results = this.fallbackSpatialIndex.findRoutesNearPoint(point, radiusMeters);
      return { results } as T;
    }

    if (type === 'QUERY_PLAN') {
      const { pointA, pointB, searchRadiusMeters, maxTransferMeters, enforceDirection } =
        payload;
      const trips = calculateTrips({
        pointA,
        pointB,
        spatialIndex: this.fallbackSpatialIndex,
        searchRadiusMeters,
        maxTransferMeters,
        enforceDirection,
      });
      return { trips } as T;
    }

    if (type === 'GET_TILE') {
      const { z, x, y } = payload;
      if (!this.fallbackTileIndex) return { buffer: null } as T;
      const tile = this.fallbackTileIndex.getTile(z, x, y);
      if (!tile) return { buffer: null } as T;
      const pbfBuffer = vtpbf.fromGeojsonVt({ routes: tile });
      return { buffer: pbfBuffer.buffer } as T;
    }

    throw new Error(`Unknown request type: ${type}`);
  }

  public async initData(payload: InitDataPayload): Promise<{
    stats: DatasetStats;
    routes: RouteItem[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geoJson: any;
  }> {
    const res = await this.sendRequest<any>('INIT_DATA', payload);
    return res;
  }

  public async queryNear(point: Coordinates, radiusMeters: number): Promise<NearResult[]> {
    const res = await this.sendRequest<{ results: NearResult[] }>('QUERY_NEAR', {
      point,
      radiusMeters,
    });
    return res.results || [];
  }

  public async queryPlan(options: {
    pointA: Coordinates;
    pointB: Coordinates;
    searchRadiusMeters: number;
    maxTransferMeters: number;
    enforceDirection: boolean;
  }): Promise<TripOption[]> {
    const res = await this.sendRequest<{ trips: TripOption[] }>('QUERY_PLAN', options);
    return res.trips || [];
  }

  public async getTile(z: number, x: number, y: number): Promise<ArrayBuffer | null> {
    const res = await this.sendRequest<{ buffer: ArrayBuffer | null }>('GET_TILE', {
      z,
      x,
      y,
    });
    return res.buffer || null;
  }
}

export const routeWorkerService = new RouteWorkerService();
