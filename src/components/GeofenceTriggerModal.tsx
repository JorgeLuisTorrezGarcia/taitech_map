import React from 'react';
import { Coordinates } from '../types.ts';
import { BellRing, VolumeX, CheckCircle, Navigation } from 'lucide-react';
import { formatDistance } from '../utils/geo.ts';

interface GeofenceTriggerModalProps {
  isOpen: boolean;
  targetName: string;
  targetCoords: Coordinates | null;
  currentDistanceMeters: number | null;
  thresholdMeters: number;
  onStopAlarm: () => void;
  onMuteSound: () => void;
  isSoundMuted: boolean;
}

export const GeofenceTriggerModal: React.FC<GeofenceTriggerModalProps> = ({
  isOpen,
  targetName,
  targetCoords,
  currentDistanceMeters,
  thresholdMeters,
  onStopAlarm,
  onMuteSound,
  isSoundMuted,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in zoom-in-95 duration-200">
      <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-center p-6 space-y-4 animate-bounce-subtle">
        {/* Urgent Pulsing Bell Icon */}
        <div className="relative mx-auto">
          <div className="absolute inset-0 rounded-full bg-amber-500/30 animate-ping" />
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/40 relative z-10 text-slate-950">
            <BellRing className="w-10 h-10 animate-wiggle" />
          </div>
        </div>

        {/* Attention Headings */}
        <div className="space-y-1">
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500 text-slate-950 inline-block shadow-sm">
            ¡Prepárate para bajarte!
          </span>
          <h2 className="text-2xl font-black text-white pt-1">
            Llegando a tu destino
          </h2>
          <p className="text-sm font-semibold text-amber-300 flex items-center justify-center gap-1.5 truncate px-2">
            <Navigation className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="truncate">{targetName}</span>
          </p>
        </div>

        {/* Distance countdown badge */}
        <div className="p-3 bg-slate-800/90 rounded-2xl border border-amber-500/40 space-y-1">
          <p className="text-xs text-slate-400">Estás a menos de:</p>
          <p className="text-3xl font-black text-amber-400">
            {currentDistanceMeters !== null
              ? formatDistance(currentDistanceMeters)
              : `~${thresholdMeters} m`}
          </p>
          <p className="text-[11px] text-slate-300">
            🔔 Toca el timbre del micro o pídele la parada al chofer.
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onStopAlarm}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-base shadow-xl shadow-emerald-500/20 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5 text-slate-950" />
            <span>DETENER ALARMA / YA ME BAJÉ</span>
          </button>

          <button
            type="button"
            onClick={onMuteSound}
            className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition flex items-center justify-center gap-2"
          >
            <VolumeX className="w-4 h-4 text-slate-400" />
            <span>{isSoundMuted ? 'Sonido silenciado' : 'Silenciar sonido'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
