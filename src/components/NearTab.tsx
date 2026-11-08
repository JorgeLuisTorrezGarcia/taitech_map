import React from 'react';
import { Coordinates, NearResult } from '../types.ts';
import { MapPin, Navigation, Sliders, ArrowRightCircle, Sparkles, Crosshair, X } from 'lucide-react';
import { formatDistance } from '../utils/geo.ts';

interface NearTabProps {
  pointP: Coordinates | null;
  nearResults: NearResult[];
  searchRadiusMeters: number;
  isLoading: boolean;
  onSetSearchRadius: (meters: number) => void;
  onUseCurrentLocation: () => void;
  onClearPointP: () => void;
  onHighlightRoute: (routeId: string) => void;
  onSetPointAs: (type: 'A' | 'B', coords: Coordinates) => void;
}

export const NearTab: React.FC<NearTabProps> = ({
  pointP,
  nearResults,
  searchRadiusMeters,
  isLoading,
  onSetSearchRadius,
  onUseCurrentLocation,
  onClearPointP,
  onHighlightRoute,
  onSetPointAs,
}) => {
  const RADIUS_PRESETS = [300, 500, 800, 1200, 2000];

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Target Point Selector Card */}
      <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs border border-sky-500/40">
              <Crosshair className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-200">
              Punto de Consulta (Cerca)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onUseCurrentLocation}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition shadow-sm font-medium"
              title="Obtener mi ubicación GPS"
            >
              <Navigation className="w-3 h-3" />
              <span>Mi GPS</span>
            </button>
            {pointP && (
              <button
                onClick={onClearPointP}
                className="p-1 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title="Quitar punto"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {pointP ? (
          <div className="flex items-center justify-between text-xs bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-mono text-[11px]">
                {pointP[1].toFixed(5)}, {pointP[0].toFixed(5)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => onSetPointAs('A', pointP)}
                className="text-emerald-400 hover:underline px-1.5 py-0.5 rounded hover:bg-emerald-950/50"
              >
                → Como A
              </button>
              <button
                onClick={() => onSetPointAs('B', pointP)}
                className="text-rose-400 hover:underline px-1.5 py-0.5 rounded hover:bg-rose-950/50"
              >
                → Como B
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-sky-300/90 bg-sky-950/30 border border-sky-800/40 p-2 rounded-lg flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400 flex-none" />
            <span>Toca cualquier calle o punto en el mapa para ver los micros que pasan cerca.</span>
          </div>
        )}

        {/* Radius Slider & Presets */}
        <div className="pt-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              Radio de búsqueda:
            </span>
            <span className="font-bold text-sky-400 font-mono text-xs">
              {formatDistance(searchRadiusMeters)}
            </span>
          </div>

          <input
            type="range"
            min={100}
            max={2500}
            step={50}
            value={searchRadiusMeters}
            onChange={(e) => onSetSearchRadius(parseInt(e.target.value, 10))}
            className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />

          <div className="flex items-center gap-1.5 pt-0.5">
            {RADIUS_PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => onSetSearchRadius(m)}
                className={`flex-1 py-0.5 text-[10px] rounded-md border transition font-medium ${
                  searchRadiusMeters === m
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                    : 'bg-slate-900/50 text-slate-400 border-slate-700 hover:bg-slate-800'
                }`}
              >
                {formatDistance(m)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs px-0.5">
        <span className="text-slate-300 font-medium">
          {isLoading
            ? 'Buscando con RBush spatial index...'
            : pointP
            ? `${nearResults.length} línea(s) pasan a menos de ${formatDistance(searchRadiusMeters)}`
            : 'Selecciona un punto en el mapa'}
        </span>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 -mr-1">
        {!pointP ? (
          <div className="text-center py-10 px-4 text-slate-400">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 mx-auto flex items-center justify-center text-sky-400 mb-2 font-bold text-xl">
              ◎
            </div>
            <p className="font-medium text-slate-300">Explora las líneas cercanas</p>
            <p className="text-xs mt-1 text-slate-400">
              Haz clic en cualquier punto del mapa o presiona <strong>Mi GPS</strong> para descubrir qué micros pasan a tu alrededor.
            </p>
          </div>
        ) : nearResults.length === 0 ? (
          <div className="text-center py-8 px-4 text-slate-400 bg-slate-800/30 rounded-xl border border-slate-800">
            <p className="font-medium text-slate-300">Ningún micro encontrado</p>
            <p className="text-xs mt-1 text-slate-400">
              No hay líneas registradas dentro de {formatDistance(searchRadiusMeters)}. Prueba aumentando el radio de búsqueda arriba.
            </p>
          </div>
        ) : (
          nearResults.map((item) => (
            <div
              key={item.routeId}
              onClick={() => onHighlightRoute(item.routeId)}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/80 transition cursor-pointer select-none group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-full flex-none shadow-sm"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-slate-100 truncate">
                      {item.routeLabel}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                        item.direction === 1
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                          : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                      }`}
                    >
                      {item.direction === 1 ? 'S1 (Ida)' : 'S2 (Vuelta)'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    🚶 Distancia a pie: <strong className="text-sky-300">{formatDistance(item.distanceMeters)}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onHighlightRoute(item.routeId);
                  }}
                  className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Ver ruta en el mapa"
                >
                  <ArrowRightCircle className="w-4 h-4 text-sky-400" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
