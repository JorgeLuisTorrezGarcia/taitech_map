export type Coordinates = [number, number]; // [longitude, latitude]

export interface RouteFeatureProperties {
  objectid?: number;
  nombre?: string;
  name?: string;
  linea?: string;
  sentido?: number; // 1 (Ida), 2 (Vuelta)
  origen?: number | string;
  medio?: number | string;
  destino?: number | string;
  desdoble?: number;
  sindicato?: number;
  parque_a?: number;
  color?: string;
  [key: string]: unknown;
}

export interface RouteItem {
  id: string; // unique ID e.g. "Línea 72-1"
  label: string; // e.g. "Línea 72"
  direction: number; // 1 (Ida) or 2 (Vuelta)
  directionLabel: string; // "Ida (S1)" or "Vuelta (S2)"
  color: string;
  coordinates: Coordinates[]; // Flattened sequence of coordinates for this route
  totalDistanceMeters: number;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
  rawProperties?: RouteFeatureProperties;
}

export interface SpatialSegment {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  routeId: string;
  routeLabel: string;
  direction: number;
  segmentIndex: number;
  p1: Coordinates;
  p2: Coordinates;
  distAlongMeters: number;
  segmentLengthMeters: number;
}

export interface NearResult {
  routeId: string;
  routeLabel: string;
  direction: number;
  color: string;
  distanceMeters: number;
  nearestPoint: Coordinates;
  distAlongMeters: number;
  fractionAlong: number;
  totalDistanceMeters: number;
}

export interface TripLeg {
  routeId: string;
  routeLabel: string;
  direction: number;
  color: string;
  boardPoint: Coordinates;
  alightPoint: Coordinates;
  boardDistAlongMeters: number;
  alightDistAlongMeters: number;
  rideDistanceMeters: number;
  estimatedRideMinutes: number;
  pathCoordinates: Coordinates[];
}

export interface TripOption {
  id: string;
  type: 'direct' | 'transfer' | 'walk-only';
  summary: string;
  totalTimeMinutes: number;
  totalWalkMeters: number;
  totalRideMeters: number;
  legs: TripLeg[];
  walkSegments: {
    from: Coordinates;
    to: Coordinates;
    distanceMeters: number;
    estimatedMinutes: number;
    instruction: string;
  }[];
  steps: string[];
}

export interface POIItem {
  id: string | number;
  name: string;
  category: string;
  lat: number;
  lon: number;
  dir?: string;
  desc?: string;
}

export interface DatasetStats {
  featureCount: number;
  routeCount: number;
  segmentCount: number;
  totalDistanceKm: number;
  fileSizeBytes: number;
  fileName: string;
  loadTimeMs: number;
}

export interface GeofenceAlarmConfig {
  isActive: boolean;
  targetCoords: Coordinates | null;
  targetName: string;
  thresholdMeters: number; // 100, 200, 300
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  isTriggered: boolean;
  currentDistanceMeters: number | null;
  currentAccuracyMeters: number | null;
}

export interface AgentFunctionCall {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  functionCalls?: AgentFunctionCall[];
  actionExecuted?: boolean;
}

