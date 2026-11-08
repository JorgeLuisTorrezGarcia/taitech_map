import React, { useState } from 'react';
import { Coordinates, TripOption } from '../types.ts';
import {
  ArrowUpDown,
  Navigation,
  Sliders,
  Footprints,
  Clock,
  ArrowRight,
  Route,
  CheckCircle2,
  X,
  BellRing,
} from 'lucide-react';
import { formatDistance, formatDuration } from '../utils/geo.ts';

interface RoutePlanTabProps {
  pointA: Coordinates | null;
  pointB: Coordinates | null;
  pointAAddress: string;
  pointBAddress: string;
  routeTarget: 'A' | 'B';
  trips: TripOption[];
  activeTrip: TripOption | null;
  isLoading: boolean;
  searchRadiusMeters: number;
  maxTransferMeters: number;
  enforceDirection: boolean;
  onSetRouteTarget: (target: 'A' | 'B') => void;
  onSwapPoints: () => void;
  onUseCurrentLocationForA: () => void;
  onClearPoint: (target: 'A' | 'B') => void;
  onSelectTrip: (trip: TripOption) => void;
  onUpdateParams: (params: {
    searchRadiusMeters?: number;
    maxTransferMeters?: number;
    enforceDirection?: boolean;
  }) => void;
  onSetGeofenceAlarm?: (target: Coordinates, name: string) => void;
  isGeofenceActive?: boolean;
}

export const RoutePlanTab: React.FC<RoutePlanTabProps> = ({
  pointA,
  pointB,
  pointAAddress,
  pointBAddress,
  routeTarget,
  trips,
  activeTrip,
  isLoading,
  searchRadiusMeters,
  maxTransferMeters,
  enforceDirection,
  onSetRouteTarget,
  onSwapPoints,
  onUseCurrentLocationForA,
  onClearPoint,
  onSelectTrip,
  onUpdateParams,
  onSetGeofenceAlarm,
  isGeofenceActive,
}) => {

  const [showSettings, setShowSettings] = useState(false);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(
    activeTrip?.id || null
  );

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Origin / Destination Box */}
      <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-2 relative">
        {/* Point A (Origin) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSetRouteTarget('A')}
            className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center transition border ${
              routeTarget === 'A'
                ? 'bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-500/30'
                : 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60 hover:bg-emerald-900/60'
            }`}
            title="Seleccionar en el mapa para Punto A"
          >
            A
          </button>
          <div
            onClick={() => onSetRouteTarget('A')}
            className={`flex-1 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer truncate transition ${
              routeTarget === 'A'
                ? 'bg-slate-900 border-emerald-500/80 text-emerald-300 ring-1 ring-emerald-500/30'
                : 'bg-slate-900/60 border-slate-700/70 text-slate-200 hover:border-slate-600'
            }`}
          >
            {pointA ? (
              pointAAddress || `${pointA[1].toFixed(5)}, ${pointA[0].toFixed(5)}`
            ) : (
              <span className="text-slate-400 italic">
                {routeTarget === 'A'
                  ? '👉 Toca el mapa para fijar Punto A'
                  : 'Fijar Origen A...'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onUseCurrentLocationForA}
              className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Usar mi ubicación GPS actual"
            >
              <Navigation className="w-3.5 h-3.5 text-emerald-400" />
            </button>
            {pointA && (
              <button
                onClick={() => onClearPoint('A')}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition"
                title="Limpiar punto A"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Swap points & separator */}
        <div className="flex items-center justify-between px-2">
          <div className="h-px bg-slate-700/60 flex-1 ml-7 mr-2" />
          <button
            onClick={onSwapPoints}
            className="p-1 rounded-md bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-600/60"
            title="Invertir Origen y Destino"
          >
            <ArrowUpDown className="w-3 h-3 text-slate-300" />
          </button>
        </div>

        {/* Point B (Destination) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSetRouteTarget('B')}
            className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center transition border ${
              routeTarget === 'B'
                ? 'bg-rose-500 text-white border-rose-400 ring-2 ring-rose-500/30'
                : 'bg-rose-950/80 text-rose-400 border-rose-700/60 hover:bg-rose-900/60'
            }`}
            title="Seleccionar en el mapa para Punto B"
          >
            B
          </button>
          <div
            onClick={() => onSetRouteTarget('B')}
            className={`flex-1 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer truncate transition ${
              routeTarget === 'B'
                ? 'bg-slate-900 border-rose-500/80 text-rose-300 ring-1 ring-rose-500/30'
                : 'bg-slate-900/60 border-slate-700/70 text-slate-200 hover:border-slate-600'
            }`}
          >
            {pointB ? (
              pointBAddress || `${pointB[1].toFixed(5)}, ${pointB[0].toFixed(5)}`
            ) : (
              <span className="text-slate-400 italic">
                {routeTarget === 'B'
                  ? '👉 Toca el mapa para fijar Punto B'
                  : 'Fijar Destino B...'}
              </span>
            )}
          </div>
          {pointB && (
            <button
              onClick={() => onClearPoint('B')}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition"
              title="Limpiar punto B"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Settings button toggle */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
          <span>
            {pointA && pointB
              ? 'Ruta lista'
              : 'Selecciona ambos puntos para calcular'}
          </span>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-700/50 hover:bg-slate-700"
          >
            <Sliders className="w-3 h-3" />
            <span>Parámetros</span>
          </button>
        </div>

        {/* Expandable Parameters */}
        {showSettings && (
          <div className="mt-2 pt-2 border-t border-slate-700/60 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Radio parada (A y B):</span>
              <div className="flex items-center gap-1">
                {[300, 500, 800].map((r) => (
                  <button
                    key={r}
                    onClick={() => onUpdateParams({ searchRadiusMeters: r })}
                    className={`px-2 py-0.5 rounded text-[10px] border ${
                      searchRadiusMeters === r
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {r} m
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Transbordo máx:</span>
              <div className="flex items-center gap-1">
                {[150, 300, 500].map((t) => (
                  <button
                    key={t}
                    onClick={() => onUpdateParams({ maxTransferMeters: t })}
                    className={`px-2 py-0.5 rounded text-[10px] border ${
                      maxTransferMeters === t
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    {t} m
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={enforceDirection}
                  onChange={(e) =>
                    onUpdateParams({ enforceDirection: e.target.checked })
                  }
                  className="rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500"
                />
                <span>Respetar sentido de ida / vuelta</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Geofence Proximity Alarm banner for Point B */}
      {pointB && onSetGeofenceAlarm && (
        <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-600/40 text-xs flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <BellRing className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-amber-200 text-xs truncate">
                {isGeofenceActive ? 'Alerta de Bajada Activa' : 'Alerta de Bajada GPS'}
              </p>
              <p className="text-[11px] text-slate-300 truncate">
                {isGeofenceActive
                  ? 'Avisará con sonido y vibración al llegar'
                  : 'Avísame a 100, 200 o 300 m antes del destino'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSetGeofenceAlarm(pointB, pointBAddress || 'Punto B (Destino)')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition shadow-sm ${
              isGeofenceActive
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            {isGeofenceActive ? 'Configurar' : 'Activar Alarma'}
          </button>
        </div>
      )}

      {/* Trip Calculation Results Header */}
      <div className="flex items-center justify-between text-xs px-0.5">
        <span className="text-slate-300 font-medium">
          {isLoading
            ? 'Calculando mejores combinaciones...'
            : pointA && pointB
            ? `${trips.length} opción(es) de viaje encontradas`
            : 'Fija los puntos A y B en el mapa'}
        </span>
      </div>

      {/* Trips list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
        {!pointA || !pointB ? (
          <div className="text-center py-10 px-4 text-slate-400">
            <Route className="w-10 h-10 mx-auto text-slate-600 mb-2 stroke-1" />
            <p className="font-medium text-slate-300">Planificador de Rutas</p>
            <p className="text-xs mt-1 text-slate-400">
              1. Toca <strong>A</strong> o haz clic en el mapa para marcar tu origen.
              <br />
              2. Toca <strong>B</strong> en tu destino para encontrar micros directos o con 1 transbordo.
            </p>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-800/30 rounded-xl border border-slate-800 text-slate-400">
            <p className="font-medium text-slate-300">Sin ruta con estos parámetros</p>
            <p className="text-xs mt-1">
              Prueba aumentando el <strong>Radio parada</strong> o el <strong>Transbordo máx</strong> en los parámetros.
            </p>
          </div>
        ) : (
          trips.map((trip) => {
            const isSelected = activeTrip?.id === trip.id;
            const isExpanded = expandedTripId === trip.id;

            return (
              <div
                key={trip.id}
                onClick={() => {
                  onSelectTrip(trip);
                  setExpandedTripId(isExpanded ? null : trip.id);
                }}
                className={`p-3 rounded-xl border transition cursor-pointer select-none ${
                  isSelected
                    ? 'bg-slate-800/90 border-emerald-500 ring-1 ring-emerald-500/40 shadow-lg'
                    : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/70'
                }`}
              >
                {/* Trip Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {trip.type === 'walk-only' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-700 text-slate-200">
                        🚶 Solo a pie
                      </span>
                    ) : trip.type === 'direct' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                        ⚡ Directo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-700/60">
                        🔄 1 Transbordo
                      </span>
                    )}

                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-200">
                      {trip.legs.map((leg, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <ArrowRight className="w-3 h-3 text-slate-500" />}
                          <span className="flex items-center gap-1">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: leg.color }}
                            />
                            <span>{leg.routeLabel}</span>
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-emerald-400 font-bold text-sm">
                    <Clock className="w-3.5 h-3.5" />
                    <span>~{trip.totalTimeMinutes} min</span>
                  </div>
                </div>

                {/* Sub info: Total Walk & Total Ride */}
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                  <span className="flex items-center gap-1">
                    <Footprints className="w-3.5 h-3.5 text-slate-400" />
                    <span>A pie: <strong className="text-slate-200">{formatDistance(trip.totalWalkMeters)}</strong></span>
                  </span>
                  {trip.totalRideMeters > 0 && (
                    <span>
                      En micro: <strong className="text-slate-200">{formatDistance(trip.totalRideMeters)}</strong>
                    </span>
                  )}
                  {isSelected && (
                    <span className="ml-auto text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Ruta activa
                    </span>
                  )}
                </div>

                {/* Expanded Turn-by-Turn Steps */}
                {isExpanded && (
                  <div className="mt-3 pt-2.5 border-t border-slate-700/60 space-y-2 text-xs">
                    <p className="font-semibold text-slate-300 text-[11px]">
                      Itinerario detallado:
                    </p>
                    {trip.steps.map((step, sIdx) => (
                      <div key={sIdx} className="flex items-start gap-2 text-slate-300 text-[11px]">
                        <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 flex-none mt-0.5">
                          {sIdx + 1}
                        </span>
                        <span className="leading-tight">{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
