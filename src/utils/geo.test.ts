import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineDistance,
  projectPointOnSegment,
  nearestPointOnPolyline,
  slicePolylineBetweenDistances,
  normalizeRouteName,
  formatDistance,
  formatDuration,
  parseCoordinateInput,
} from './geo.ts';
import { SpatialRouteIndex } from './spatial-index.ts';
import { calculateTrips } from './routing.ts';
import type { RouteItem } from '../types.ts';

test('haversineDistance calculates realistic distances', () => {
  // Santa Cruz Plaza 24 de Septiembre: [-63.1821, -17.7833]
  // Cristo Redentor (approx 2.5 km north): [-63.1812, -17.7613]
  const dist = haversineDistance(-63.1821, -17.7833, -63.1812, -17.7613);
  assert.ok(dist > 2300 && dist < 2600, `Expected ~2.4km, got ${dist}`);
});

test('projectPointOnSegment accurately projects point', () => {
  const p1: [number, number] = [-63.18, -17.78];
  const p2: [number, number] = [-63.17, -17.78];
  const query: [number, number] = [-63.175, -17.779]; // slightly north of middle

  const proj = projectPointOnSegment(query[0], query[1], p1[0], p1[1], p2[0], p2[1]);
  assert.ok(proj.fraction > 0.45 && proj.fraction < 0.55);
  assert.ok(proj.distanceMeters > 0 && proj.distanceMeters < 200);
});

test('normalizeRouteName handles diverse naming conventions', () => {
  assert.equal(normalizeRouteName('0-linea 72'), 'Línea 72');
  assert.equal(normalizeRouteName('1-linea 11'), 'Línea 11');
  assert.equal(normalizeRouteName('linea 101'), 'Línea 101');
  assert.equal(normalizeRouteName('18'), 'Línea 18');
});

test('formatDistance and formatDuration format properly', () => {
  assert.equal(formatDistance(350), '350 m');
  assert.equal(formatDistance(2400), '2.4 km');
  assert.equal(formatDuration(15), '15 min');
  assert.equal(formatDuration(75), '1 h 15 min');
});

test('parseCoordinateInput extracts valid lat/lon pairs', () => {
  const coords1 = parseCoordinateInput('-17.7833, -63.1821');
  assert.ok(coords1);
  assert.equal(coords1![0], -63.1821);
  assert.equal(coords1![1], -17.7833);

  const coordsUrl = parseCoordinateInput('https://maps.google.com/?q=@-17.78,-63.18');
  assert.ok(coordsUrl);
  assert.equal(coordsUrl![0], -63.18);
  assert.equal(coordsUrl![1], -17.78);
});

test('SpatialRouteIndex and routing calculation find direct and transfer trips', () => {
  // Create mock Santa Cruz routes:
  // Route 1 (Línea 72 East-West): goes from [-63.20, -17.78] to [-63.16, -17.78]
  // Route 2 (Línea 11 North-South): goes from [-63.18, -17.80] to [-63.18, -17.76]
  const route1: RouteItem = {
    id: 'Línea 72-1',
    label: 'Línea 72',
    direction: 1,
    directionLabel: 'Ida (S1)',
    color: '#10b981',
    coordinates: [
      [-63.20, -17.78],
      [-63.18, -17.78],
      [-63.16, -17.78],
    ],
    totalDistanceMeters: haversineDistance(-63.20, -17.78, -63.16, -17.78),
    bbox: [-63.20, -17.78, -63.16, -17.78],
  };

  const route2: RouteItem = {
    id: 'Línea 11-1',
    label: 'Línea 11',
    direction: 1,
    directionLabel: 'Ida (S1)',
    color: '#3b82f6',
    coordinates: [
      [-63.18, -17.80],
      [-63.18, -17.78],
      [-63.18, -17.76],
    ],
    totalDistanceMeters: haversineDistance(-63.18, -17.80, -63.18, -17.76),
    bbox: [-63.18, -17.80, -63.18, -17.76],
  };

  const index = new SpatialRouteIndex();
  index.buildIndex([route1, route2]);

  assert.equal(index.getSegmentCount(), 4);

  // Near test: point near Route 1
  const near = index.findRoutesNearPoint([-63.19, -17.7801], 200);
  assert.ok(near.length > 0);
  assert.equal(near[0].routeLabel, 'Línea 72');

  // Direct trip test along Route 1: A=[-63.195, -17.78], B=[-63.165, -17.78]
  const directTrips = calculateTrips({
    pointA: [-63.195, -17.78],
    pointB: [-63.165, -17.78],
    spatialIndex: index,
    searchRadiusMeters: 600,
  });

  assert.ok(directTrips.length > 0);
  const directTrip = directTrips.find((t) => t.type === 'direct');
  assert.ok(directTrip);
  assert.equal(directTrip!.legs[0].routeLabel, 'Línea 72');

  // Transfer trip test: from start of Route 1 to end of Route 2:
  // A=[-63.198, -17.78], B=[-63.18, -17.762]
  const transferTrips = calculateTrips({
    pointA: [-63.198, -17.78],
    pointB: [-63.18, -17.762],
    spatialIndex: index,
    searchRadiusMeters: 600,
    maxTransferMeters: 300,
  });

  const transfer = transferTrips.find((t) => t.type === 'transfer');
  assert.ok(transfer, 'Should find transfer from Línea 72 to Línea 11 at intersection');
  assert.equal(transfer!.legs.length, 2);
  assert.equal(transfer!.legs[0].routeLabel, 'Línea 72');
  assert.equal(transfer!.legs[1].routeLabel, 'Línea 11');
});
