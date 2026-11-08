import type { Coordinates } from '../types.ts';

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates great-circle distance between two coordinates in meters using Haversine formula.
 */
export function haversineDistance(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Projects a point (px, py) onto a line segment (x1, y1) -> (x2, y2).
 * Coordinates are [lon, lat]. Approximates local flat-earth projection scaled for latitude.
 */
export function projectPointOnSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { nearest: Coordinates; distanceMeters: number; fraction: number } {
  const meanLatRad = (((y1 + y2 + py) / 3) * Math.PI) / 180;
  const cosLat = Math.cos(meanLatRad);

  // Convert degrees to meters locally
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * cosLat;

  const dx = (x2 - x1) * mPerDegLon;
  const dy = (y2 - y1) * mPerDegLat;
  const segLenSq = dx * dx + dy * dy;

  if (segLenSq === 0) {
    const dist = haversineDistance(px, py, x1, y1);
    return { nearest: [x1, y1], distanceMeters: dist, fraction: 0 };
  }

  const dpx = (px - x1) * mPerDegLon;
  const dpy = (py - y1) * mPerDegLat;

  let t = (dpx * dx + dpy * dy) / segLenSq;
  t = Math.max(0, Math.min(1, t));

  const nearestX = x1 + t * (x2 - x1);
  const nearestY = y1 + t * (y2 - y1);
  const dist = haversineDistance(px, py, nearestX, nearestY);

  return { nearest: [nearestX, nearestY], distanceMeters: dist, fraction: t };
}

/**
 * Finds the nearest point on a polyline coordinates array.
 */
export function nearestPointOnPolyline(
  px: number,
  py: number,
  coords: Coordinates[]
): {
  nearest: Coordinates;
  distanceMeters: number;
  segmentIndex: number;
  distAlongMeters: number;
  fractionAlong: number;
  totalDistanceMeters: number;
} {
  if (coords.length < 2) {
    const p = coords[0] || [px, py];
    const dist = haversineDistance(px, py, p[0], p[1]);
    return {
      nearest: p,
      distanceMeters: dist,
      segmentIndex: 0,
      distAlongMeters: 0,
      fractionAlong: 0,
      totalDistanceMeters: 0,
    };
  }

  let minDistance = Infinity;
  let bestNearest: Coordinates = coords[0];
  let bestSegIdx = 0;
  let distAlongBeforeBest = 0;
  let segFraction = 0;

  let currentDistAlong = 0;
  const segDistances: number[] = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const segDist = haversineDistance(p1[0], p1[1], p2[0], p2[1]);
    segDistances.push(segDist);

    const proj = projectPointOnSegment(px, py, p1[0], p1[1], p2[0], p2[1]);
    if (proj.distanceMeters < minDistance) {
      minDistance = proj.distanceMeters;
      bestNearest = proj.nearest;
      bestSegIdx = i;
      distAlongBeforeBest = currentDistAlong;
      segFraction = proj.fraction;
    }
    currentDistAlong += segDist;
  }

  const totalDist = currentDistAlong;
  const bestSegLen = segDistances[bestSegIdx] || 0;
  const bestDistAlong = distAlongBeforeBest + segFraction * bestSegLen;

  return {
    nearest: bestNearest,
    distanceMeters: minDistance,
    segmentIndex: bestSegIdx,
    distAlongMeters: bestDistAlong,
    fractionAlong: totalDist > 0 ? bestDistAlong / totalDist : 0,
    totalDistanceMeters: totalDist,
  };
}

/**
 * Slices a polyline between distAlongStart and distAlongEnd (meters).
 */
export function slicePolylineBetweenDistances(
  coords: Coordinates[],
  startDistMeters: number,
  endDistMeters: number
): Coordinates[] {
  if (coords.length < 2) return coords;

  const start = Math.min(startDistMeters, endDistMeters);
  const end = Math.max(startDistMeters, endDistMeters);
  const reversed = startDistMeters > endDistMeters;

  const sliced: Coordinates[] = [];
  let currentDist = 0;
  let started = false;

  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const segDist = haversineDistance(p1[0], p1[1], p2[0], p2[1]);
    const nextDist = currentDist + segDist;

    if (!started && nextDist >= start) {
      const frac = segDist > 0 ? Math.max(0, (start - currentDist) / segDist) : 0;
      const startPoint: Coordinates = [
        p1[0] + frac * (p2[0] - p1[0]),
        p1[1] + frac * (p2[1] - p1[1]),
      ];
      sliced.push(startPoint);
      started = true;
    }

    if (started) {
      if (nextDist >= end) {
        const frac = segDist > 0 ? Math.min(1, (end - currentDist) / segDist) : 0;
        const endPoint: Coordinates = [
          p1[0] + frac * (p2[0] - p1[0]),
          p1[1] + frac * (p2[1] - p1[1]),
        ];
        sliced.push(endPoint);
        break;
      } else {
        sliced.push(p2);
      }
    }

    currentDist = nextDist;
  }

  if (sliced.length === 0) {
    sliced.push(coords[0], coords[coords.length - 1]);
  }

  return reversed ? [...sliced].reverse() : sliced;
}

/**
 * Normalizes route names e.g. "0-linea 72" -> "Línea 72"
 */
export function normalizeRouteName(rawName: string | undefined): string {
  if (!rawName) return 'Línea Desconocida';
  let s = rawName.trim();
  // Remove prefixes like "0-", "1-", "0 - ", etc.
  s = s.replace(/^\s*\d+\s*[-_:]\s*/i, '');
  // Normalize "linea" to "Línea"
  s = s.replace(/^linea\s*/i, 'Línea ');
  if (!/^línea/i.test(s) && !/^linea/i.test(s)) {
    s = 'Línea ' + s;
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Deterministic vivid color palette for transit lines
 */
export function getRouteColor(label: string, direction: number = 1): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 37 + label.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  const saturation = 80;
  const lightness = direction === 2 ? 55 : 44;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Formats distance for clean UI display.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/**
 * Formats time in minutes.
 */
export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const hours = Math.floor(m / 60);
  const remainingMin = m % 60;
  return remainingMin > 0 ? `${hours} h ${remainingMin} min` : `${hours} h`;
}

/**
 * Parses user input into [lon, lat] coordinates.
 * Handles:
 * - "lat, lon" or "lon, lat"
 * - Google maps URLs e.g. "@-17.78,-63.18"
 * - Cruzero URLs
 */
export function parseCoordinateInput(input: string): Coordinates | null {
  if (!input) return null;
  const s = decodeURIComponent(input.trim());

  // Check for Google Maps URL or similar containing @lat,lon
  const atMatch = s.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lon = parseFloat(atMatch[2]);
    // Santa Cruz is approx lat -17.78, lon -63.18
    return [lon, lat];
  }

  // Look for two float numbers
  const numMatches = s.match(/-?\d+\.\d+/g);
  if (numMatches && numMatches.length >= 2) {
    const n1 = parseFloat(numMatches[0]);
    const n2 = parseFloat(numMatches[1]);

    // If one is around -17 and one around -63:
    // Santa Cruz Lat is around -17.8, Lon is around -63.18
    if (Math.abs(n1) < 40 && Math.abs(n2) > 40) {
      // n1 is Lat, n2 is Lon
      return [n2, n1];
    } else if (Math.abs(n2) < 40 && Math.abs(n1) > 40) {
      // n1 is Lon, n2 is Lat
      return [n1, n2];
    }
    // Default assumption: [lon, lat] or [lat, lon]
    return [n2, n1];
  }

  return null;
}
