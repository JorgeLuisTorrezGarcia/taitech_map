import React, { useMemo, useState } from 'react';
import { RouteItem } from '../types.ts';
import { Search, Eye, EyeOff, Navigation, Compass } from 'lucide-react';
import { formatDistance } from '../utils/geo.ts';

interface LinesTabProps {
  routes: RouteItem[];
  visibleRouteIds: Set<string>;
  highlightedRouteId: string | null;
  onToggleRouteVisibility: (routeId: string) => void;
  onShowAllRoutes: () => void;
  onHideAllRoutes: () => void;
  onHighlightRoute: (routeId: string) => void;
  onZoomToRoute: (route: RouteItem) => void;
}

export const LinesTab: React.FC<LinesTabProps> = ({
  routes,
  visibleRouteIds,
  highlightedRouteId,
  onToggleRouteVisibility,
  onShowAllRoutes,
  onHideAllRoutes,
  onHighlightRoute,
  onZoomToRoute,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter routes by search query
  const filteredRoutes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return routes;
    return routes.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.directionLabel.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [routes, searchQuery]);

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar línea de micro (ej. 72, 11, 101)..."
          className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-0.5">
        <span>
          Mostrando <strong className="text-slate-200">{filteredRoutes.length}</strong> de {routes.length} rutas
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onShowAllRoutes}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Activar todas las rutas en el mapa"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ver todas</span>
          </button>
          <button
            onClick={onHideAllRoutes}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Ocultar todas las rutas"
          >
            <EyeOff className="w-3.5 h-3.5 text-rose-400" />
            <span>Ocultar</span>
          </button>
        </div>
      </div>

      {/* Route List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 -mr-1">
        {filteredRoutes.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400">
            <Compass className="w-10 h-10 mx-auto text-slate-600 mb-2 stroke-1" />
            <p className="font-medium text-slate-300">No se encontraron líneas</p>
            <p className="text-xs mt-1">Intenta buscar otro número o nombre de línea.</p>
          </div>
        ) : (
          filteredRoutes.map((route) => {
            const isVisible = visibleRouteIds.has(route.id);
            const isHighlighted = highlightedRouteId === route.id && isVisible;

            return (
              <div
                key={route.id}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer select-none ${
                  isHighlighted
                    ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/50'
                    : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-800/90'
                }`}
                onClick={() => {
                  if (isHighlighted) {
                    onHighlightRoute('');
                  } else {
                    onHighlightRoute(route.id);
                  }
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleRouteVisibility(route.id);
                      }}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                  </div>
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-none shadow-sm"
                    style={{ backgroundColor: route.color }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm text-slate-100 truncate">
                        {route.label}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          route.direction === 1
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                        }`}
                      >
                        {route.direction === 1 ? 'Ida (S1)' : 'Vuelta (S2)'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Recorrido: {formatDistance(route.totalDistanceMeters)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleRouteVisibility(route.id);
                    }}
                    className={`p-1.5 rounded-lg transition ${
                      isVisible
                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                        : 'bg-slate-800/80 text-slate-500 hover:text-slate-300'
                    }`}
                    title={isVisible ? 'Ocultar línea del mapa' : 'Mostrar línea en el mapa'}
                  >
                    {isVisible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onZoomToRoute(route);
                    }}
                    className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Centrar línea en el mapa"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
