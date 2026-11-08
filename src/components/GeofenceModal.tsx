import React, { useState } from 'react';
import { Coordinates, GeofenceAlarmConfig } from '../types.ts';
import {
  BellRing,
  Volume2,
  VolumeX,
  Smartphone,
  Navigation,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { formatDistance } from '../utils/geo.ts';
import { playChimeBeep, triggerVibration } from '../utils/audioAlarm.ts';

interface GeofenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  alarmConfig: GeofenceAlarmConfig;
  pointB: Coordinates | null;
  pointBAddress: string;
  pointP: Coordinates | null;
  onActivateAlarm: (targetCoords: Coordinates, targetName: string, threshold: number, sound: boolean, vibrate: boolean) => void;
  onDeactivateAlarm: () => void;
  onSimulateApproach: () => void;
  isSimulating: boolean;
}

export const GeofenceModal: React.FC<GeofenceModalProps> = ({
  isOpen,
  onClose,
  alarmConfig,
  pointB,
  pointBAddress,
  pointP,
  onActivateAlarm,
  onDeactivateAlarm,
  onSimulateApproach,
  isSimulating,
}) => {
  const [selectedThreshold, setSelectedThreshold] = useState<number>(
    alarmConfig.thresholdMeters || 200
  );
  const [enableSound, setEnableSound] = useState<boolean>(alarmConfig.soundEnabled);
  const [enableVibrate, setEnableVibrate] = useState<boolean>(alarmConfig.vibrateEnabled);

  // Fallback target: either current alarm target, or Point B, or Point P
  const targetCoords: Coordinates | null =
    alarmConfig.targetCoords || pointB || pointP || null;

  const targetName: string =
    alarmConfig.targetName ||
    (pointB
      ? pointBAddress || 'Punto B (Destino)'
      : pointP
      ? 'Punto seleccionado en mapa'
      : 'Destino no seleccionado');

  if (!isOpen) return null;

  const handleTestSoundAndVibe = () => {
    playChimeBeep();
    triggerVibration([300, 150, 300, 150, 500]);
  };

  const handleActivate = () => {
    if (!targetCoords) return;
    onActivateAlarm(targetCoords, targetName, selectedThreshold, enableSound, enableVibrate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-900 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <BellRing className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-100 flex items-center gap-1.5">
                Alerta de Bajada por GPS
              </h2>
              <p className="text-xs text-amber-300/80">
                Avísame cuando esté cerca de mi destino
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-300">
          {/* Target destination banner */}
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Punto de Destino / Bajada
            </span>
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold text-slate-100 text-sm truncate">
                {targetName}
              </span>
            </div>
            {targetCoords ? (
              <p className="text-[11px] text-slate-400">
                Coordenadas: {targetCoords[1].toFixed(5)}, {targetCoords[0].toFixed(5)}
              </p>
            ) : (
              <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Fija el Punto B en el mapa o selecciona un Lugar para activar la alarma.
              </p>
            )}
          </div>

          {/* Distance threshold selector: 100m, 200m, 300m */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Distancia de aviso antes de llegar:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 100, label: '100 m', desc: '~1 cuadra antes' },
                { value: 200, label: '200 m', desc: '~2 cuadras (Recomendado)', popular: true },
                { value: 300, label: '300 m', desc: '~3 cuadras antes' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedThreshold(opt.value)}
                  className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center justify-center relative ${
                    selectedThreshold === opt.value
                      ? 'bg-amber-950/70 border-amber-500 text-amber-200 ring-2 ring-amber-500/40 shadow-md'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {opt.popular && (
                    <span className="absolute -top-2 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-slate-950">
                      Ideal
                    </span>
                  )}
                  <span className="font-bold text-sm">{opt.label}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Ideal si viajas de noche o no conoces la zona. Te avisará a tiempo para tocar el timbre del micro.
            </p>
          </div>

          {/* Sound & Vibration toggles */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEnableSound(!enableSound)}
              className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition text-left ${
                enableSound
                  ? 'bg-slate-800 border-amber-500/60 text-slate-100'
                  : 'bg-slate-800/40 border-slate-700/70 text-slate-400'
              }`}
            >
              {enableSound ? (
                <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">Sonido alarma</p>
                <p className="text-[10px] text-slate-400">
                  {enableSound ? 'Activado' : 'Silencio'}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setEnableVibrate(!enableVibrate)}
              className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition text-left ${
                enableVibrate
                  ? 'bg-slate-800 border-amber-500/60 text-slate-100'
                  : 'bg-slate-800/40 border-slate-700/70 text-slate-400'
              }`}
            >
              <Smartphone className={`w-4 h-4 shrink-0 ${enableVibrate ? 'text-amber-400' : 'text-slate-500'}`} />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">Vibración</p>
                <p className="text-[10px] text-slate-400">
                  {enableVibrate ? 'Activada' : 'Desactivada'}
                </p>
              </div>
            </button>
          </div>

          {/* Live Status or Simulation Box */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Estado del GPS:</span>
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                {alarmConfig.isActive ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    <span className="text-emerald-400">Rastreando en vivo</span>
                  </>
                ) : (
                  <span className="text-slate-400">Alarma en espera</span>
                )}
              </span>
            </div>

            {alarmConfig.isActive && alarmConfig.currentDistanceMeters !== null && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Distancia actual al destino:</span>
                  <span className="font-bold text-amber-300 text-sm">
                    {formatDistance(alarmConfig.currentDistanceMeters)}
                  </span>
                </div>
                {/* Progress bar to threshold */}
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          10,
                          (1 - alarmConfig.currentDistanceMeters / 1000) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Test & Simulation Buttons */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={handleTestSoundAndVibe}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5"
                title="Probar sonido de alarma y vibración"
              >
                <Play className="w-3 h-3 text-amber-400" />
                <span>Probar tono</span>
              </button>

              <button
                type="button"
                onClick={onSimulateApproach}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 border ml-auto ${
                  isSimulating
                    ? 'bg-rose-950/80 border-rose-700 text-rose-300 animate-pulse'
                    : 'bg-indigo-950/80 border-indigo-700/70 text-indigo-200 hover:bg-indigo-900'
                }`}
                title="Simula que el micro va avanzando hacia el destino para probar la alarma sin moverte"
              >
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>{isSimulating ? 'Detener Simulación' : 'Simular Acercamiento'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-3">
          {alarmConfig.isActive ? (
            <>
              <button
                type="button"
                onClick={onDeactivateAlarm}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-900/40 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Desactivar Alarma</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
              >
                Mantener Activa y Cerrar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={!targetCoords}
                onClick={handleActivate}
                className={`flex-1 py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg ${
                  targetCoords
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 ring-2 ring-amber-400/40'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <BellRing className="w-4 h-4" />
                <span>Activar Alarma de Bajada ({selectedThreshold} m)</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
