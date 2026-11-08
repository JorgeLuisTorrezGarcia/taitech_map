import React from 'react';
import { Navigation, Trash2, HelpCircle, Layers, BellRing } from 'lucide-react';

interface FloatingActionsProps {
  onLocateUser: () => void;
  onClearMap: () => void;
  onOpenHelp: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onOpenGeofenceModal: () => void;
  isGeofenceActive: boolean;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({
  onLocateUser,
  onClearMap,
  onOpenHelp,
  onToggleSidebar,
  isSidebarOpen,
  onOpenGeofenceModal,
  isGeofenceActive,
}) => {
  return (
    <div className="absolute right-3.5 bottom-24 sm:bottom-6 z-20 flex flex-col items-center gap-2 select-none">
      {/* Toggle drawer on mobile */}
      <button
        onClick={onToggleSidebar}
        className="w-11 h-11 rounded-2xl bg-slate-900/90 text-slate-100 hover:text-white hover:bg-slate-800 shadow-xl border border-white/10 flex items-center justify-center transition sm:hidden"
        title="Ver panel de líneas y rutas"
        aria-label="Alternar panel"
      >
        <Layers className="w-5 h-5 text-emerald-400" />
      </button>

      {/* Geofence / Bajada Alarm button */}
      <button
        onClick={onOpenGeofenceModal}
        className={`w-11 h-11 rounded-2xl shadow-xl border flex items-center justify-center transition group active:scale-95 relative ${
          isGeofenceActive
            ? 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-400/50 shadow-amber-500/20'
            : 'bg-slate-900/90 text-slate-100 hover:text-white hover:bg-slate-800 border-white/10'
        }`}
        title="Alerta de Bajada por GPS (Avísame cuando esté cerca)"
        aria-label="Alerta de Bajada por GPS"
      >
        <BellRing
          className={`w-5 h-5 ${
            isGeofenceActive ? 'text-slate-950 animate-bounce' : 'text-amber-400 group-hover:scale-110'
          } transition`}
        />
        {isGeofenceActive && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
        )}
      </button>

      {/* GPS Locate button */}
      <button
        onClick={onLocateUser}
        className="w-11 h-11 rounded-2xl bg-slate-900/90 text-slate-100 hover:text-white hover:bg-slate-800 shadow-xl border border-white/10 flex items-center justify-center transition group active:scale-95"
        title="Mi ubicación actual (GPS)"
        aria-label="Obtener mi ubicación GPS"
      >
        <Navigation className="w-5 h-5 text-sky-400 group-hover:scale-110 transition" />
      </button>

      {/* Clear active points and selection */}
      <button
        onClick={onClearMap}
        className="w-11 h-11 rounded-2xl bg-slate-900/90 text-slate-100 hover:text-white hover:bg-slate-800 shadow-xl border border-white/10 flex items-center justify-center transition group active:scale-95"
        title="Limpiar mapa (quitar puntos A, B y P)"
        aria-label="Limpiar mapa"
      >
        <Trash2 className="w-5 h-5 text-rose-400 group-hover:scale-110 transition" />
      </button>

      {/* Info / Guide modal */}
      <button
        onClick={onOpenHelp}
        className="w-11 h-11 rounded-2xl bg-slate-900/90 text-slate-100 hover:text-white hover:bg-slate-800 shadow-xl border border-white/10 flex items-center justify-center transition group active:scale-95"
        title="Guía y ayuda sobre los micros de Santa Cruz"
        aria-label="Ver ayuda y guía"
      >
        <HelpCircle className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition" />
      </button>
    </div>
  );
};

