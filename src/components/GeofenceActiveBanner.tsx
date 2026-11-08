import React from 'react';
import { GeofenceAlarmConfig } from '../types.ts';
import { BellRing, X, Settings2 } from 'lucide-react';
import { formatDistance } from '../utils/geo.ts';

interface GeofenceActiveBannerProps {
  alarmConfig: GeofenceAlarmConfig;
  onOpenModal: () => void;
  onCancelAlarm: () => void;
}

export const GeofenceActiveBanner: React.FC<GeofenceActiveBannerProps> = ({
  alarmConfig,
  onOpenModal,
  onCancelAlarm,
}) => {
  if (!alarmConfig.isActive || alarmConfig.isTriggered) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 w-[94%] max-w-md animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
      <div className="bg-slate-900/95 backdrop-blur-md border border-amber-500/50 shadow-2xl rounded-2xl p-2.5 flex items-center justify-between gap-3 text-slate-100 ring-1 ring-amber-500/20">
        {/* Left icon with pulse */}
        <div
          onClick={onOpenModal}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <BellRing className="w-4 h-4 animate-pulse" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                Alarma GPS
              </span>
              <span className="text-xs font-semibold text-slate-200 truncate">
                {alarmConfig.targetName}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 truncate mt-0.5">
              {alarmConfig.currentDistanceMeters !== null ? (
                <>
                  A <strong className="text-amber-300">{formatDistance(alarmConfig.currentDistanceMeters)}</strong> (avisa a {alarmConfig.thresholdMeters} m)
                </>
              ) : (
                <>Avisa a {alarmConfig.thresholdMeters} m del destino</>
              )}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onOpenModal}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Configurar alarma"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            onClick={onCancelAlarm}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 transition"
            title="Cancelar alarma"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
