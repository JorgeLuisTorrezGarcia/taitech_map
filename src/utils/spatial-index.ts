import RBush from 'rbush';
import type { Coordinates, NearResult, RouteItem, SpatialSegment } from '../types.ts';
import { haversineDistance, projectPointOnSegment } from './geo.ts';

export class SpatialRouteIndex {
  private tree: RBush<SpatialSegment>;
  private routesById: Map<string, RouteItem> = new Map();
  private totalSegmentsCount: number = 0;

  constructor() {
    this.tree = new RBush<SpatialSegment>(16);
  }

  /**
   * Clears and indexes all segments from an array of routes.
   */
  public buildIndex(routes: RouteItem[]): void {
    this.tree.clear();
    this.routesById.clear();
    const segments: SpatialSegment[] = [];

    for (const route of routes) {
      this.routesById.set(route.id, route);
      const coords = route.coordinates;
      let distAlong = 0;

      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const segLen = haversineDistance(p1[0], p1[1], p2[0], p2[1]);

        const minX = Math.min(p1[0], p2[0]);
        const maxX = Math.max(p1[0], p2[0]);
        const minY = Math.min(p1[1], p2[1]);
        const maxY = Math.max(p1[1], p2[1]);

        segments.push({
          minX,
          minY,
          maxX,
          maxY,
          routeId: route.id,
          routeLabel: route.label,
          direction: route.direction,
          segmentIndex: i,
          p1,
          p2,
          distAlongMeters: distAlong,
          segmentLengthMeters: segLen,
        });

        distAlong += segLen;
      }
    }

    this.tree.load(segments);
    this.totalSegmentsCount = segments.length;
  }

  public getSegmentCount(): number {
    return this.totalSegmentsCount;
  }

  public getRoute(id: string): RouteItem | undefined {
    return this.routesById.get(id);
  }

  public getAllRoutes(): RouteItem[] {
    return Array.from(this.routesById.values());
  }

  /**
   * Finds all route segments within a given search radius (meters) of a point [lon, lat].
   */
  public querySegmentsNear(
    lon: number,
    lat: number,
    radiusMeters: number
  ): SpatialSegment[] {
    // 1 deg lat ~ 111320 meters
    const degLat = radiusMeters / 111320;
    // 1 deg lon ~ 111320 * cos(lat) meters
    const degLon = radiusMeters / (111320 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));

    const bbox = {
      minX: lon - degLon,
      minY: lat - degLat,
      maxX: lon + degLon,
      maxY: lat + degLat,
    };

    return this.tree.search(bbox);
  }

  /**
   * Finds unique routes passing within radiusMeters of [lon, lat],
   * sorted by walking/distance from the point to the route.
   */
  public findRoutesNearPoint(
    point: Coordinates,
    radiusMeters: number
  ): NearResult[] {
    const [px, py] = point;
    const candidateSegments = this.querySegmentsNear(px, py, radiusMeters);

    // Group by routeId and find the closest projection
    const bestByRoute = new Map<string, NearResult>();

    for (const seg of candidateSegments) {
      const proj = projectPointOnSegment(
        px,
        py,
        seg.p1[0],
        seg.p1[1],
        seg.p2[0],
        seg.p2[1]
      );

      if (proj.distanceMeters <= radiusMeters) {
        const existing = bestByRoute.get(seg.routeId);
        if (!existing || proj.distanceMeters < existing.distanceMeters) {
          const route = this.routesById.get(seg.routeId);
          const totalDist = route?.totalDistanceMeters || 1;
          const distAlong = seg.distAlongMeters + proj.fraction * seg.segmentLengthMeters;

          bestByRoute.set(seg.routeId, {
            routeId: seg.routeId,
            routeLabel: seg.routeLabel,
            direction: seg.direction,
            color: route?.color || '#16a34a',
            distanceMeters: proj.distanceMeters,
            nearestPoint: proj.nearest,
            distAlongMeters: distAlong,
            fractionAlong: totalDist > 0 ? distAlong / totalDist : 0,
            totalDistanceMeters: totalDist,
          });
        }
      }
    }

    return Array.from(bestByRoute.values()).sort(
      (a, b) => a.distanceMeters - b.distanceMeters
    );
  }
}
