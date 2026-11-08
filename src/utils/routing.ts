import type { Coordinates, TripLeg, TripOption } from '../types.ts';
import {
  formatDistance,
  formatDuration,
  haversineDistance,
  slicePolylineBetweenDistances,
} from './geo.ts';
import { SpatialRouteIndex } from './spatial-index.ts';

export interface RoutePlanningOptions {
  pointA: Coordinates;
  pointB: Coordinates;
  spatialIndex: SpatialRouteIndex;
  searchRadiusMeters?: number;
  maxTransferMeters?: number;
  enforceDirection?: boolean;
}

const WALK_SPEED_M_MIN = 80; // ~4.8 km/h
const BUS_SPEED_M_MIN = 260; // ~15.6 km/h (Santa Cruz urban traffic)
const BUS_INITIAL_WAIT_MIN = 4;
const TRANSFER_WAIT_MIN = 6;

export function calculateTrips(options: RoutePlanningOptions): TripOption[] {
  const {
    pointA,
    pointB,
    spatialIndex,
    searchRadiusMeters = 500,
    maxTransferMeters = 300,
    enforceDirection = true,
  } = options;

  const straightLineDist = haversineDistance(
    pointA[0],
    pointA[1],
    pointB[0],
    pointB[1]
  );

  const results: TripOption[] = [];

  // 1. Direct Walking Option if points are reasonably close (< 1500m)
  if (straightLineDist <= 1500) {
    const walkMinutes = straightLineDist / WALK_SPEED_M_MIN;
    results.push({
      id: 'walk-direct',
      type: 'walk-only',
      summary: 'Caminar directo',
      totalTimeMinutes: Math.round(walkMinutes),
      totalWalkMeters: straightLineDist,
      totalRideMeters: 0,
      legs: [],
      walkSegments: [
        {
          from: pointA,
          to: pointB,
          distanceMeters: straightLineDist,
          estimatedMinutes: Math.round(walkMinutes),
          instruction: `Camina directo ${formatDistance(straightLineDist)} hasta el destino B (aprox. ${formatDuration(walkMinutes)}).`,
        },
      ],
      steps: [
        `🚶 Camina ${formatDistance(straightLineDist)} directamente hasta el punto de destino (≈ ${formatDuration(walkMinutes)}).`,
      ],
    });
  }

  // 2. Query candidates at A and B
  const nearA = spatialIndex.findRoutesNearPoint(pointA, searchRadiusMeters);
  const nearB = spatialIndex.findRoutesNearPoint(pointB, searchRadiusMeters);

  if (nearA.length === 0 || nearB.length === 0) {
    return results;
  }

  const mapB = new Map(nearB.map((nb) => [nb.routeId, nb]));

  // Direct routes: lines passing near A and near B
  for (const candA of nearA) {
    const candB = mapB.get(candA.routeId);
    if (!candB) continue;

    // Directionality check
    const isDirectionValid = !enforceDirection || candA.distAlongMeters < candB.distAlongMeters;
    if (!isDirectionValid) continue;

    const rideDist = Math.abs(candB.distAlongMeters - candA.distAlongMeters);
    if (rideDist < 100) continue; // Skip trivial stops

    const route = spatialIndex.getRoute(candA.routeId);
    if (!route) continue;

    const walkA = candA.distanceMeters;
    const walkB = candB.distanceMeters;
    const totalWalk = walkA + walkB;

    const rideMinutes = rideDist / BUS_SPEED_M_MIN;
    const walkMinutes = totalWalk / WALK_SPEED_M_MIN;
    const totalTime = walkMinutes + rideMinutes + BUS_INITIAL_WAIT_MIN;

    const pathCoords = slicePolylineBetweenDistances(
      route.coordinates,
      candA.distAlongMeters,
      candB.distAlongMeters
    );

    const leg: TripLeg = {
      routeId: route.id,
      routeLabel: route.label,
      direction: route.direction,
      color: route.color,
      boardPoint: candA.nearestPoint,
      alightPoint: candB.nearestPoint,
      boardDistAlongMeters: candA.distAlongMeters,
      alightDistAlongMeters: candB.distAlongMeters,
      rideDistanceMeters: rideDist,
      estimatedRideMinutes: Math.round(rideMinutes),
      pathCoordinates: pathCoords,
    };

    const dirTag = route.direction === 1 ? 'S1 (Ida)' : 'S2 (Vuelta)';

    results.push({
      id: `direct-${route.id}`,
      type: 'direct',
      summary: `${route.label} (${dirTag})`,
      totalTimeMinutes: Math.round(totalTime),
      totalWalkMeters: Math.round(totalWalk),
      totalRideMeters: Math.round(rideDist),
      legs: [leg],
      walkSegments: [
        {
          from: pointA,
          to: candA.nearestPoint,
          distanceMeters: walkA,
          estimatedMinutes: Math.round(walkA / WALK_SPEED_M_MIN),
          instruction: `Camina ${formatDistance(walkA)} hacia la parada de ${route.label}.`,
        },
        {
          from: candB.nearestPoint,
          to: pointB,
          distanceMeters: walkB,
          estimatedMinutes: Math.round(walkB / WALK_SPEED_M_MIN),
          instruction: `Camina ${formatDistance(walkB)} desde la parada hasta tu destino B.`,
        },
      ],
      steps: [
        `🚶 Camina ${formatDistance(walkA)} hasta la parada de ${route.label} (${dirTag}).`,
        `🚌 Sube a ${route.label} y viaja ${formatDistance(rideDist)} (≈ ${formatDuration(rideMinutes)}).`,
        `🛑 Bájate en la parada más cercana a tu destino.`,
        `🚶 Camina ${formatDistance(walkB)} hasta el punto B.`,
      ],
    });
  }

  // 3. One-Transfer Routes (Line 1 from A -> Transfer -> Line 2 to B)
  // Limit to top 10 candidates at A and top 10 at B for blazing speed
  const topA = nearA.slice(0, 10);
  const topB = nearB.slice(0, 10);

  for (const candA of topA) {
    const route1 = spatialIndex.getRoute(candA.routeId);
    if (!route1) continue;

    // Sample points along route1 after candA.distAlongMeters
    const r1Len = route1.totalDistanceMeters;
    const startMeters = candA.distAlongMeters;
    const sampleStepMeters = 200; // sample every 200m

    // Pre-calculate sample points along route1
    const samples: { point: Coordinates; distAlong: number }[] = [];
    let curDist = startMeters + sampleStepMeters;
    while (curDist < r1Len - 100) {
      // Find coordinate along route1 at curDist
      const ptSlice = slicePolylineBetweenDistances(route1.coordinates, curDist, curDist + 1);
      if (ptSlice.length > 0) {
        samples.push({ point: ptSlice[0], distAlong: curDist });
      }
      curDist += sampleStepMeters;
    }

    if (samples.length === 0) continue;

    for (const candB of topB) {
      // Skip if same line label
      if (candB.routeLabel === candA.routeLabel) continue;

      const route2 = spatialIndex.getRoute(candB.routeId);
      if (!route2) continue;

      let bestTransfer: {
        sampleDistAlong1: number;
        transferWalkMeters: number;
        alight1: Coordinates;
        board2: Coordinates;
        boardDistAlong2: number;
        totalMins: number;
      } | null = null;

      // Find the closest transfer opportunity between route1 samples and route2 (before candB)
      for (const smp of samples) {
        const nearOnR2 = spatialIndex.findRoutesNearPoint(smp.point, maxTransferMeters);
        const match2 = nearOnR2.find((m) => m.routeId === route2.id);

        if (!match2) continue;

        // Verify direction on route2: board point must be before candB
        if (enforceDirection && match2.distAlongMeters >= candB.distAlongMeters) {
          continue;
        }

        const ride1 = smp.distAlong - candA.distAlongMeters;
        const ride2 = candB.distAlongMeters - match2.distAlongMeters;
        if (ride1 < 150 || ride2 < 150) continue;

        const transferWalk = match2.distanceMeters;
        const totalWalk = candA.distanceMeters + transferWalk + candB.distanceMeters;
        const totalRide = ride1 + ride2;

        const estMinutes =
          totalWalk / WALK_SPEED_M_MIN +
          totalRide / BUS_SPEED_M_MIN +
          BUS_INITIAL_WAIT_MIN +
          TRANSFER_WAIT_MIN;

        if (!bestTransfer || estMinutes < bestTransfer.totalMins) {
          bestTransfer = {
            sampleDistAlong1: smp.distAlong,
            transferWalkMeters: transferWalk,
            alight1: smp.point,
            board2: match2.nearestPoint,
            boardDistAlong2: match2.distAlongMeters,
            totalMins: estMinutes,
          };
        }
      }

      if (bestTransfer) {
        const rideDist1 = bestTransfer.sampleDistAlong1 - candA.distAlongMeters;
        const rideDist2 = candB.distAlongMeters - bestTransfer.boardDistAlong2;
        const rideMins1 = rideDist1 / BUS_SPEED_M_MIN;
        const rideMins2 = rideDist2 / BUS_SPEED_M_MIN;

        const walkA = candA.distanceMeters;
        const walkB = candB.distanceMeters;
        const totalWalk = walkA + bestTransfer.transferWalkMeters + walkB;
        const totalRide = rideDist1 + rideDist2;

        const path1 = slicePolylineBetweenDistances(
          route1.coordinates,
          candA.distAlongMeters,
          bestTransfer.sampleDistAlong1
        );
        const path2 = slicePolylineBetweenDistances(
          route2.coordinates,
          bestTransfer.boardDistAlong2,
          candB.distAlongMeters
        );

        const leg1: TripLeg = {
          routeId: route1.id,
          routeLabel: route1.label,
          direction: route1.direction,
          color: route1.color,
          boardPoint: candA.nearestPoint,
          alightPoint: bestTransfer.alight1,
          boardDistAlongMeters: candA.distAlongMeters,
          alightDistAlongMeters: bestTransfer.sampleDistAlong1,
          rideDistanceMeters: rideDist1,
          estimatedRideMinutes: Math.round(rideMins1),
          pathCoordinates: path1,
        };

        const leg2: TripLeg = {
          routeId: route2.id,
          routeLabel: route2.label,
          direction: route2.direction,
          color: route2.color,
          boardPoint: bestTransfer.board2,
          alightPoint: candB.nearestPoint,
          boardDistAlongMeters: bestTransfer.boardDistAlong2,
          alightDistAlongMeters: candB.distAlongMeters,
          rideDistanceMeters: rideDist2,
          estimatedRideMinutes: Math.round(rideMins2),
          pathCoordinates: path2,
        };

        results.push({
          id: `transfer-${route1.id}-${route2.id}`,
          type: 'transfer',
          summary: `${route1.label} → ${route2.label}`,
          totalTimeMinutes: Math.round(bestTransfer.totalMins),
          totalWalkMeters: Math.round(totalWalk),
          totalRideMeters: Math.round(totalRide),
          legs: [leg1, leg2],
          walkSegments: [
            {
              from: pointA,
              to: candA.nearestPoint,
              distanceMeters: walkA,
              estimatedMinutes: Math.round(walkA / WALK_SPEED_M_MIN),
              instruction: `Camina ${formatDistance(walkA)} hacia la parada de ${route1.label}.`,
            },
            {
              from: bestTransfer.alight1,
              to: bestTransfer.board2,
              distanceMeters: bestTransfer.transferWalkMeters,
              estimatedMinutes: Math.round(bestTransfer.transferWalkMeters / WALK_SPEED_M_MIN),
              instruction: `Transbordo: camina ${formatDistance(bestTransfer.transferWalkMeters)} hacia la parada de ${route2.label}.`,
            },
            {
              from: candB.nearestPoint,
              to: pointB,
              distanceMeters: walkB,
              estimatedMinutes: Math.round(walkB / WALK_SPEED_M_MIN),
              instruction: `Camina ${formatDistance(walkB)} hasta tu destino B.`,
            },
          ],
          steps: [
            `🚶 Camina ${formatDistance(walkA)} hasta la parada de ${route1.label}.`,
            `🚌 Toma ${route1.label} y viaja ${formatDistance(rideDist1)} (≈ ${formatDuration(rideMins1)}).`,
            `🔄 Bájate y camina ${formatDistance(bestTransfer.transferWalkMeters)} para transbordar a ${route2.label}.`,
            `🚌 Sube a ${route2.label} y viaja ${formatDistance(rideDist2)} (≈ ${formatDuration(rideMins2)}).`,
            `🚶 Bájate y camina ${formatDistance(walkB)} hasta B.`,
          ],
        });
      }
    }
  }

  // Deduplicate and filter: keep the best unique route combinations
  const seenCombos = new Set<string>();
  const ranked = results
    .sort((a, b) => {
      // Direct trips get a small bonus for convenience
      const scoreA = a.totalTimeMinutes + (a.type === 'transfer' ? 4 : 0);
      const scoreB = b.totalTimeMinutes + (b.type === 'transfer' ? 4 : 0);
      return scoreA - scoreB;
    })
    .filter((trip) => {
      const key = trip.legs.map((l) => `${l.routeLabel}_S${l.direction}`).join('>');
      if (!key) return true; // walk only
      if (seenCombos.has(key)) return false;
      seenCombos.add(key);
      return true;
    });

  return ranked.slice(0, 8);
}
