import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Coordinates,
  DatasetStats,
  NearResult,
  POIItem,
  RouteItem,
  TripOption,
  GeofenceAlarmConfig,
} from './types.ts';
import { routeWorkerService } from './workers/worker-client.ts';
import { MapComponent } from './components/MapComponent.tsx';
import { LinesTab } from './components/LinesTab.tsx';
import { NearTab } from './components/NearTab.tsx';
import { RoutePlanTab } from './components/RoutePlanTab.tsx';
import { PlacesTab } from './components/PlacesTab.tsx';
import { DatasetTab } from './components/DatasetTab.tsx';
import { FloatingActions } from './components/FloatingActions.tsx';
import { InfoModal } from './components/InfoModal.tsx';
import { GeofenceModal } from './components/GeofenceModal.tsx';
import { GeofenceTriggerModal } from './components/GeofenceTriggerModal.tsx';
import { GeofenceActiveBanner } from './components/GeofenceActiveBanner.tsx';
import { CopilotTab } from './components/CopilotTab.tsx';
import { haversineDistance } from './utils/geo.ts';
import { startAlarmLoop, stopAlarmLoop } from './utils/audioAlarm.ts';
import {
  Bus,
  MapPin,
  Route as RouteIcon,
  Compass,
  FileCode,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export default function App() {
  // Routes & Data state
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [visibleRouteIds, setVisibleRouteIds] = useState<Set<string>>(new Set());
  const [highlightedRouteId, setHighlightedRouteId] = useState<string | null>(null);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [pois, setPois] = useState<POIItem[]>([]);
  const [selectedPOI, setSelectedPOI] = useState<POIItem | null>(null);

  // Active navigation / tab
  const [activeTab, setActiveTab] = useState<
    'copilot' | 'lines' | 'near' | 'route' | 'places' | 'dataset'
  >('copilot');

  // Mobile tab navigation scrolling refs
  const mobileTabContainerRef = useRef<HTMLDivElement>(null);
  const mobileTabItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Auto-scroll active tab into view in mobile navigator
  useEffect(() => {
    const el = mobileTabItemRefs.current[activeTab];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  // Near mode state
  const [pointP, setPointP] = useState<Coordinates | null>(null);
  const [nearResults, setNearResults] = useState<NearResult[]>([]);
  const [searchRadiusMeters, setSearchRadiusMeters] = useState<number>(500);

  // Route Planning mode state
  const [pointA, setPointA] = useState<Coordinates | null>(null);
  const [pointB, setPointB] = useState<Coordinates | null>(null);
  const [pointAAddress, setPointAAddress] = useState<string>('');
  const [pointBAddress, setPointBAddress] = useState<string>('');
  const [routeTarget, setRouteTarget] = useState<'A' | 'B'>('A');
  const [maxTransferMeters, setMaxTransferMeters] = useState<number>(300);
  const [enforceDirection, setEnforceDirection] = useState<boolean>(true);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [activeTrip, setActiveTrip] = useState<TripOption | null>(null);

  // Geofence / Proximity Drop-off Alarm state
  const [alarmConfig, setAlarmConfig] = useState<GeofenceAlarmConfig>({
    isActive: false,
    targetCoords: null,
    targetName: '',
    thresholdMeters: 200,
    soundEnabled: true,
    vibrateEnabled: true,
    isTriggered: false,
    currentDistanceMeters: null,
    currentAccuracyMeters: null,
  });
  const [isGeofenceModalOpen, setIsGeofenceModalOpen] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);
  const [isSimulatingApproach, setIsSimulatingApproach] = useState<boolean>(false);
  const simulationIntervalRef = useRef<number | null>(null);
  const watchPositionIdRef = useRef<number | null>(null);

  // Loading & UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [mobileDrawerHeight, setMobileDrawerHeight] = useState<'collapsed' | 'half' | 'full'>('half');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  // Load Initial Base Routes Dataset
  const loadDefaultDataset = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/data/rutas_micro_scz.geojson');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      const res = await routeWorkerService.initData({
        geoJsonText: text,
        fileName: 'rutas_micro_scz.geojson',
        fileSizeBytes: text.length,
      });

      setRoutes(res.routes);
      setGeoJsonData(res.geoJson);
      setStats(res.stats);

      // Make all base routes visible initially
      const ids = new Set(res.routes.map((r) => r.id));
      setVisibleRouteIds(ids);

      showToast(`¡${res.routes.length} rutas cargadas en ${res.stats.loadTimeMs} ms!`);
    } catch (err: unknown) {
      console.error('Error cargando rutas predeterminadas:', err);
      showToast('Error al cargar archivo inicial de rutas');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Load Santa Cruz POIs (Places of Interest)
  useEffect(() => {
    fetch('/data/lugares_scz.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((items) => {
        if (Array.isArray(items)) {
          setPois(items);
        }
      })
      .catch((e) => console.warn('Could not load POIs', e));
  }, []);

  useEffect(() => {
    loadDefaultDataset();
  }, [loadDefaultDataset]);

  // Handle custom file upload (including 26MB GeoJSON)
  const handleLoadCustomFile = async (file: File) => {
    setIsLoading(true);
    showToast(`Cargando ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`);

    try {
      const text = await file.text();
      const res = await routeWorkerService.initData({
        geoJsonText: text,
        fileName: file.name,
        fileSizeBytes: file.size,
      });

      setRoutes(res.routes);
      setGeoJsonData(res.geoJson);
      setStats(res.stats);

      const ids = new Set(res.routes.map((r) => r.id));
      setVisibleRouteIds(ids);

      showToast(`Archivo procesado: ${res.stats.routeCount} rutas indexadas en ${res.stats.loadTimeMs} ms.`);
    } catch (err: unknown) {
      console.error('Error cargando archivo GeoJSON personalizado:', err);
      showToast('Error al procesar el archivo GeoJSON');
    } finally {
      setIsLoading(false);
    }
  };

  // Run Near Query whenever pointP or searchRadiusMeters changes
  useEffect(() => {
    if (!pointP) {
      setNearResults([]);
      return;
    }

    let isSubscribed = true;
    routeWorkerService
      .queryNear(pointP, searchRadiusMeters)
      .then((results) => {
        if (isSubscribed) {
          setNearResults(results);
          // Auto-visible nearest routes
          if (results.length > 0) {
            const nearIds = new Set(results.map((r) => r.routeId));
            setVisibleRouteIds(nearIds);
          }
        }
      })
      .catch((err) => console.error('Error in queryNear:', err));

    return () => {
      isSubscribed = false;
    };
  }, [pointP, searchRadiusMeters]);

  // Run Route Planning whenever pointA, pointB, or params change
  useEffect(() => {
    if (!pointA || !pointB) {
      setTrips([]);
      setActiveTrip(null);
      return;
    }

    let isSubscribed = true;
    setIsLoading(true);

    routeWorkerService
      .queryPlan({
        pointA,
        pointB,
        searchRadiusMeters,
        maxTransferMeters,
        enforceDirection,
      })
      .then((calculatedTrips) => {
        if (isSubscribed) {
          setTrips(calculatedTrips);
          if (calculatedTrips.length > 0) {
            setActiveTrip(calculatedTrips[0]);
            // Make the involved routes visible
            const involvedIds = new Set<string>();
            calculatedTrips[0].legs.forEach((leg) => involvedIds.add(leg.routeId));
            setVisibleRouteIds(involvedIds);
          } else {
            setActiveTrip(null);
          }
        }
      })
      .catch((err) => console.error('Error in queryPlan:', err))
      .finally(() => {
        if (isSubscribed) setIsLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [pointA, pointB, searchRadiusMeters, maxTransferMeters, enforceDirection]);

  // Map Click Handler: responds based on activeTab
  const handleMapClickPoint = (coords: Coordinates) => {
    if (activeTab === 'near') {
      setPointP(coords);
      showToast('Punto de consulta fijado');
    } else if (activeTab === 'route') {
      if (routeTarget === 'A') {
        setPointA(coords);
        setPointAAddress('');
        setRouteTarget('B');
        showToast('Punto A fijado. Ahora toca tu destino B');
      } else {
        setPointB(coords);
        setPointBAddress('');
        showToast('Punto B fijado. Calculando rutas...');
      }
    } else {
      // In other modes, click sets point P and switches to near mode for convenience
      setPointP(coords);
      setActiveTab('near');
      showToast('Punto seleccionado para consulta cercana');
    }
  };

  // GPS Locate User
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      showToast('Geolocalización no soportada por el navegador');
      return;
    }

    showToast('Buscando señal GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: Coordinates = [pos.coords.longitude, pos.coords.latitude];
        if (activeTab === 'route') {
          if (routeTarget === 'A') {
            setPointA(coords);
            setPointAAddress('Mi ubicación actual');
            setRouteTarget('B');
            showToast('Punto A fijado con tu GPS');
          } else {
            setPointB(coords);
            setPointBAddress('Mi ubicación actual');
            showToast('Punto B fijado con tu GPS');
          }
        } else {
          setPointP(coords);
          setActiveTab('near');
          showToast('Ubicación GPS establecida');
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        showToast('No se pudo acceder al GPS. Revisa permisos de ubicación.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // GPS watcher for Geofence Proximity Alarm
  useEffect(() => {
    if (!alarmConfig.isActive || isSimulatingApproach || !alarmConfig.targetCoords) {
      if (watchPositionIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Tu dispositivo no soporta geolocalización GPS');
      return;
    }

    const [tLon, tLat] = alarmConfig.targetCoords;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const uLon = pos.coords.longitude;
        const uLat = pos.coords.latitude;
        const dist = Math.round(haversineDistance(uLon, uLat, tLon, tLat));

        setAlarmConfig((prev) => {
          const shouldTrigger = !prev.isTriggered && dist <= prev.thresholdMeters;
          if (shouldTrigger) {
            startAlarmLoop(prev.soundEnabled, prev.vibrateEnabled);
          }
          return {
            ...prev,
            currentDistanceMeters: dist,
            currentAccuracyMeters: Math.round(pos.coords.accuracy),
            isTriggered: prev.isTriggered || shouldTrigger,
          };
        });
      },
      (err) => {
        console.warn('Geolocation watch error:', err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    watchPositionIdRef.current = id;

    return () => {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
    };
  }, [alarmConfig.isActive, isSimulatingApproach, alarmConfig.targetCoords, showToast]);

  // Clean up alarm sound & vibrations on unmount
  useEffect(() => {
    return () => {
      stopAlarmLoop();
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

  const handleActivateGeofence = (
    targetCoords: Coordinates,
    targetName: string,
    threshold: number,
    sound: boolean,
    vibrate: boolean
  ) => {
    stopAlarmLoop();
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setIsSimulatingApproach(false);

    setAlarmConfig({
      isActive: true,
      targetCoords,
      targetName,
      thresholdMeters: threshold,
      soundEnabled: sound,
      vibrateEnabled: vibrate,
      isTriggered: false,
      currentDistanceMeters: null,
      currentAccuracyMeters: null,
    });
    setIsSoundMuted(false);
    showToast(`🔔 Alarma activada: te avisará a ${threshold} m de ${targetName}`);
  };

  const handleDeactivateGeofence = () => {
    stopAlarmLoop();
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setIsSimulatingApproach(false);
    setAlarmConfig((prev) => ({
      ...prev,
      isActive: false,
      isTriggered: false,
    }));
    showToast('Alarma de bajada cancelada');
  };

  const handleStopAlarm = () => {
    stopAlarmLoop();
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setIsSimulatingApproach(false);
    setAlarmConfig((prev) => ({
      ...prev,
      isActive: false,
      isTriggered: false,
    }));
    showToast('¡Llegada confirmada! Alarma detenida.');
  };

  const handleMuteSound = () => {
    stopAlarmLoop();
    setIsSoundMuted(true);
    showToast('Sonido silenciado');
  };

  const handleOpenGeofenceForTarget = (coords: Coordinates, name: string) => {
    setAlarmConfig((prev) => ({
      ...prev,
      targetCoords: coords,
      targetName: name,
    }));
    setIsGeofenceModalOpen(true);
  };

  const handleSimulateApproach = () => {
    if (isSimulatingApproach) {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      setIsSimulatingApproach(false);
      showToast('Simulación detenida');
      return;
    }

    const target = alarmConfig.targetCoords || pointB || pointP || [-63.1821, -17.7833];
    const name =
      alarmConfig.targetName ||
      (pointB ? pointBAddress || 'Punto B (Destino)' : 'Destino en Santa Cruz');
    const threshold = alarmConfig.thresholdMeters || 200;

    setIsSimulatingApproach(true);
    setAlarmConfig((prev) => ({
      ...prev,
      isActive: true,
      targetCoords: target,
      targetName: name,
      thresholdMeters: threshold,
      isTriggered: false,
      currentDistanceMeters: 550,
    }));
    showToast('Simulando avance en micro hacia el destino...');

    let currentDist = 550;
    simulationIntervalRef.current = window.setInterval(() => {
      currentDist -= 90;
      if (currentDist <= 40) currentDist = 40;

      setAlarmConfig((prev) => {
        const triggered = !prev.isTriggered && currentDist <= prev.thresholdMeters;
        if (triggered) {
          startAlarmLoop(prev.soundEnabled, prev.vibrateEnabled);
          if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
          }
          setIsSimulatingApproach(false);
        }
        return {
          ...prev,
          currentDistanceMeters: currentDist,
          isTriggered: prev.isTriggered || triggered,
        };
      });
    }, 1200);
  };

  // Toggle Visibility of a Route

  const handleToggleRouteVisibility = (routeId: string) => {
    setVisibleRouteIds((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
    // Immediately clear highlight if the unselected route was highlighted
    setHighlightedRouteId((prev) => (prev === routeId ? null : prev));
  };

  const handleShowAllRoutes = () => {
    setVisibleRouteIds(new Set(routes.map((r) => r.id)));
    showToast('Todas las líneas visibles');
  };

  const handleHideAllRoutes = () => {
    setVisibleRouteIds(new Set());
    setHighlightedRouteId(null);
    showToast('Líneas ocultadas');
  };

  const handleHighlightRoute = (routeId: string) => {
    if (!routeId) {
      setHighlightedRouteId(null);
      return;
    }
    setHighlightedRouteId(routeId);
    setVisibleRouteIds((prev) => new Set([...prev, routeId]));
  };

  const handleClearMap = () => {
    setPointA(null);
    setPointB(null);
    setPointP(null);
    setPointAAddress('');
    setPointBAddress('');
    setTrips([]);
    setActiveTrip(null);
    setHighlightedRouteId(null);
    setSelectedPOI(null);
    showToast('Puntos eliminados del mapa');
  };

  const handleSwapPoints = () => {
    const tempCoords = pointA;
    const tempAddr = pointAAddress;
    setPointA(pointB);
    setPointAAddress(pointBAddress);
    setPointB(tempCoords);
    setPointBAddress(tempAddr);
    showToast('Origen y Destino invertidos');
  };

  const handleSetPointAs = (type: 'A' | 'B', coords: Coordinates, name?: string) => {
    if (type === 'A') {
      setPointA(coords);
      setPointAAddress(name || '');
      setRouteTarget('B');
    } else {
      setPointB(coords);
      setPointBAddress(name || '');
    }
    setActiveTab('route');
    showToast(`Punto ${type} establecido: ${name || 'Coordenadas'}`);
  };

  const handleZoomToRoute = (route: RouteItem) => {
    handleHighlightRoute(route.id);
  };

  // Landmark coordinate dictionary for common Santa Cruz references
  const SCZ_LANDMARKS: Record<string, Coordinates> = useMemo(
    () => ({
      'el cristo': [-63.1818, -17.7695],
      'cristo redentor': [-63.1818, -17.7695],
      'plaza 24 de septiembre': [-63.1821, -17.7833],
      'plaza principal': [-63.1821, -17.7833],
      'centro': [-63.1821, -17.7833],
      'parque urbano': [-63.1706, -17.7885],
      'uagrm': [-63.1912, -17.7758],
      'la gabriel': [-63.1912, -17.7758],
      'campus': [-63.1912, -17.7758],
      'ventura': [-63.1992, -17.755],
      'ventura mall': [-63.1992, -17.755],
      'las brisas': [-63.1793, -17.7516],
      'ramada': [-63.1925, -17.794],
      'mercado la ramada': [-63.1925, -17.794],
      'pozos': [-63.1765, -17.7788],
      'mercado los pozos': [-63.1765, -17.7788],
      'mutualista': [-63.163, -17.769],
      'mercado mutualista': [-63.163, -17.769],
      'terminal bimodal': [-63.1615, -17.7925],
      'bimodal': [-63.1615, -17.7925],
      'aeropuerto el trompillo': [-63.18, -17.808],
      'cine center': [-63.174, -17.797],
    }),
    []
  );

  const resolveLocationCoords = useCallback(
    (name: string): { coords: Coordinates; label: string } | null => {
      if (!name) return null;
      const q = name.toLowerCase().trim();

      // Check landmarks map
      for (const [key, coords] of Object.entries(SCZ_LANDMARKS)) {
        if (q.includes(key) || key.includes(q)) {
          return { coords, label: name };
        }
      }

      // Check POIs list
      const matchedPOI =
        pois.find((p) => p.name.toLowerCase() === q) ||
        pois.find((p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase())) ||
        pois.find((p) => p.dir && (p.dir.toLowerCase().includes(q) || q.includes(p.dir.toLowerCase())));

      if (matchedPOI) {
        return { coords: [matchedPOI.lon, matchedPOI.lat], label: matchedPOI.name };
      }

      // Fallback to center of Santa Cruz
      return { coords: [-63.1821, -17.7833], label: name };
    },
    [pois, SCZ_LANDMARKS]
  );

  // Copilot Action Executions
  const handleExecutePlanRoute = useCallback(
    (originName: string, destName: string) => {
      const origin = resolveLocationCoords(originName);
      const dest = resolveLocationCoords(destName);

      if (origin) {
        setPointA(origin.coords);
        setPointAAddress(origin.label);
      }
      if (dest) {
        setPointB(dest.coords);
        setPointBAddress(dest.label);
      }
      setActiveTab('route');
      showToast(`Copiloto: calculando viaje de "${originName}" a "${destName}"`);
    },
    [resolveLocationCoords, showToast]
  );

  const handleExecuteNearby = useCallback(
    (locationName: string, radiusMeters?: number) => {
      const loc = resolveLocationCoords(locationName);
      if (loc) {
        setPointP(loc.coords);
        if (radiusMeters) setSearchRadiusMeters(radiusMeters);
        setActiveTab('near');
        showToast(`Copiloto: buscando micros cerca de "${locationName}"`);
      }
    },
    [resolveLocationCoords, showToast]
  );

  const handleExecuteHighlightLine = useCallback(
    (lineIdOrNumber: string) => {
      const cleanNum = lineIdOrNumber.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
      const matched = routes.find(
        (r) =>
          r.id.toLowerCase().includes(cleanNum) ||
          r.label.toLowerCase().includes(cleanNum) ||
          r.label.toLowerCase().includes(lineIdOrNumber.toLowerCase())
      );

      if (matched) {
        setVisibleRouteIds(new Set([matched.id]));
        setHighlightedRouteId(matched.id);
        setActiveTab('lines');
        showToast(`Copiloto: mostrando recorrido de ${matched.label}`);
      } else {
        showToast(`No se encontró la línea "${lineIdOrNumber}" en el sistema.`);
      }
    },
    [routes, showToast]
  );

  const handleExecuteGeofence = useCallback(
    (targetName: string, thresholdMeters?: number) => {
      const loc = resolveLocationCoords(targetName);
      const threshold = thresholdMeters || 200;
      if (loc) {
        handleActivateGeofence(loc.coords, loc.label, threshold, true, true);
      } else if (pointB) {
        handleActivateGeofence(pointB, pointBAddress || targetName, threshold, true, true);
      } else {
        showToast(`Fija el destino en el mapa para activar la alarma.`);
      }
    },
    [resolveLocationCoords, pointB, pointBAddress, handleActivateGeofence, showToast]
  );

  const handleExecuteExplorePlaces = useCallback(
    (category?: string, query?: string) => {
      setActiveTab('places');
      showToast(`Copiloto: explorando ${category || query || 'lugares'}`);
    },
    [showToast]
  );

  const tabsConfig = [
    { id: 'copilot', label: 'Copiloto IA', icon: Sparkles },
    { id: 'lines', label: 'Líneas', icon: Bus },
    { id: 'near', label: 'Cerca', icon: Compass },
    { id: 'route', label: 'A → B', icon: RouteIcon },
    { id: 'places', label: 'Lugares', icon: MapPin },
    { id: 'dataset', label: 'Dataset', icon: FileCode },
  ] as const;

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100 font-sans">
      {/* Top Navbar */}
      <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 z-30 flex items-center justify-between px-4 select-none flex-none shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-400 flex items-center justify-center text-white shadow-md shadow-emerald-950/50">
            <Bus className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm sm:text-base text-white tracking-tight">
                Micros Santa Cruz
              </h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                SCZ 🇧🇴
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              {stats
                ? `${stats.routeCount} rutas indexadas · RBush + geojson-vt activo`
                : 'Cargando sistema de rutas...'}
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/80">
          {tabsConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-testid={`desktop-tab-${tab.id}`}
                aria-label={`Pestaña ${tab.label}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (isSidebarCollapsed) setIsSidebarCollapsed(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Header Status & Info */}
        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Procesando...</span>
            </div>
          )}

          <button
            onClick={() => setIsHelpOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition flex items-center gap-1.5"
            title="Guía y Ayuda"
          >
            <span>Guía</span>
            <span className="text-[10px] bg-slate-700 px-1.5 py-0.2 rounded-md">?</span>
          </button>
        </div>
      </header>

      {/* Main Map Viewport & Overlays */}
      <div className="relative flex-1 w-full h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Full-screen MapLibre GL instance */}
        <MapComponent
          geoJsonData={geoJsonData}
          visibleRouteIds={visibleRouteIds}
          highlightedRouteId={highlightedRouteId}
          pointP={pointP}
          pointA={pointA}
          pointB={pointB}
          activeTrip={activeTrip}
          selectedPOI={selectedPOI}
          allPOIs={pois}
          activeMode={activeTab}
          routeTarget={routeTarget}
          onMapClickPoint={handleMapClickPoint}
          onSelectRoute={handleHighlightRoute}
          onSelectPOI={setSelectedPOI}
          searchRadiusMeters={searchRadiusMeters}
        />

        {/* Desktop Left Floating Sidebar */}
        <div
          className={`hidden md:flex flex-col absolute top-3 left-3 bottom-3 z-20 w-96 lg:w-[26rem] bg-slate-900/92 backdrop-blur-xl border border-slate-700/70 rounded-2xl shadow-2xl transition-all duration-300 ${
            isSidebarCollapsed ? '-translate-x-[calc(100%+1rem)]' : 'translate-x-0'
          }`}
        >
          {/* Sidebar Top bar */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100">
                {tabsConfig.find((t) => t.id === activeTab)?.label}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {activeTab === 'copilot'
                  ? 'Gemini Flash'
                  : activeTab === 'lines'
                  ? `${routes.length} líneas`
                  : activeTab === 'near'
                  ? pointP
                    ? `${nearResults.length} cercanas`
                    : 'Sin punto'
                  : activeTab === 'route'
                  ? pointA && pointB
                    ? `${trips.length} rutas`
                    : 'A → B'
                  : activeTab === 'places'
                  ? `${pois.length} lugares`
                  : 'Rendimiento'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Ocultar panel lateral"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sidebar Body with active tab component */}
          <div className="flex-1 p-3 overflow-hidden">
            {activeTab === 'copilot' && (
              <CopilotTab
                pois={pois}
                routes={routes}
                onExecutePlanRoute={handleExecutePlanRoute}
                onExecuteNearby={handleExecuteNearby}
                onExecuteHighlightLine={handleExecuteHighlightLine}
                onExecuteGeofence={handleExecuteGeofence}
                onExecuteExplorePlaces={handleExecuteExplorePlaces}
                onNavigateToTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'lines' && (
              <LinesTab
                routes={routes}
                visibleRouteIds={visibleRouteIds}
                highlightedRouteId={highlightedRouteId}
                onToggleRouteVisibility={handleToggleRouteVisibility}
                onShowAllRoutes={handleShowAllRoutes}
                onHideAllRoutes={handleHideAllRoutes}
                onHighlightRoute={handleHighlightRoute}
                onZoomToRoute={handleZoomToRoute}
              />
            )}

            {activeTab === 'near' && (
              <NearTab
                pointP={pointP}
                nearResults={nearResults}
                searchRadiusMeters={searchRadiusMeters}
                isLoading={isLoading}
                onSetSearchRadius={setSearchRadiusMeters}
                onUseCurrentLocation={handleLocateUser}
                onClearPointP={() => setPointP(null)}
                onHighlightRoute={handleHighlightRoute}
                onSetPointAs={handleSetPointAs}
              />
            )}

            {activeTab === 'route' && (
              <RoutePlanTab
                pointA={pointA}
                pointB={pointB}
                pointAAddress={pointAAddress}
                pointBAddress={pointBAddress}
                routeTarget={routeTarget}
                trips={trips}
                activeTrip={activeTrip}
                isLoading={isLoading}
                searchRadiusMeters={searchRadiusMeters}
                maxTransferMeters={maxTransferMeters}
                enforceDirection={enforceDirection}
                onSetRouteTarget={setRouteTarget}
                onSwapPoints={handleSwapPoints}
                onUseCurrentLocationForA={handleLocateUser}
                onClearPoint={(t) => (t === 'A' ? setPointA(null) : setPointB(null))}
                onSelectTrip={setActiveTrip}
                onUpdateParams={({ searchRadiusMeters: r, maxTransferMeters: m, enforceDirection: e }) => {
                  if (r !== undefined) setSearchRadiusMeters(r);
                  if (m !== undefined) setMaxTransferMeters(m);
                  if (e !== undefined) setEnforceDirection(e);
                }}
                onSetGeofenceAlarm={handleOpenGeofenceForTarget}
                isGeofenceActive={alarmConfig.isActive}
              />
            )}

            {activeTab === 'places' && (
              <PlacesTab
                pois={pois}
                selectedPOI={selectedPOI}
                onSelectPOI={setSelectedPOI}
                onSetPointAs={handleSetPointAs}
                onFlyToPOI={(poi) => setSelectedPOI(poi)}
                onSetGeofenceAlarm={handleOpenGeofenceForTarget}
              />
            )}

            {activeTab === 'dataset' && (
              <DatasetTab
                stats={stats}
                isLoading={isLoading}
                onLoadCustomFile={handleLoadCustomFile}
                onResetDefaultDataset={loadDefaultDataset}
              />
            )}
          </div>
        </div>

        {/* Collapsed Sidebar Restore Tab */}
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="hidden md:flex absolute top-4 left-3 z-20 items-center gap-1.5 px-3 py-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-xl text-xs font-semibold text-slate-200 hover:text-white transition"
          >
            <ChevronRight className="w-4 h-4 text-emerald-400" />
            <span>Abrir panel</span>
          </button>
        )}

        {/* Mobile Bottom Sheet Drawer */}
        <div
          className={`md:hidden flex flex-col absolute left-0 right-0 bottom-0 z-30 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/80 rounded-t-2xl shadow-2xl transition-all duration-300 ${
            mobileDrawerHeight === 'collapsed'
              ? 'h-16'
              : mobileDrawerHeight === 'half'
              ? 'h-[48vh]'
              : 'h-[85vh]'
          }`}
        >
          {/* Drawer Handle & Tabs */}
          <div className="flex-none p-2 border-b border-slate-800 flex items-center justify-between gap-1">
            <div className="flex items-center min-w-0 flex-1 relative">
              <button
                type="button"
                onClick={() => {
                  mobileTabContainerRef.current?.scrollBy({ left: -110, behavior: 'smooth' });
                }}
                className="p-1 -ml-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg shrink-0 transition"
                aria-label="Desplazar pestañas a la izquierda"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div
                ref={mobileTabContainerRef}
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x scroll-smooth flex-1 min-w-0 px-1 py-0.5"
              >
                {tabsConfig.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      ref={(el) => {
                        mobileTabItemRefs.current[tab.id] = el;
                      }}
                      data-testid={`mobile-tab-${tab.id}`}
                      aria-label={`Pestaña ${tab.label}`}
                      onClick={() => {
                        setActiveTab(tab.id);
                        if (mobileDrawerHeight === 'collapsed') {
                          setMobileDrawerHeight('half');
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 select-none whitespace-nowrap transition active:scale-95 ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60 font-bold'
                          : 'text-slate-300 bg-slate-800/80 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  mobileTabContainerRef.current?.scrollBy({ left: 110, behavior: 'smooth' });
                }}
                className="p-1 -mr-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg shrink-0 transition"
                aria-label="Desplazar pestañas a la derecha"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => {
                setMobileDrawerHeight((prev) =>
                  prev === 'collapsed' ? 'half' : prev === 'half' ? 'full' : 'collapsed'
                );
              }}
              className="p-1.5 rounded-xl bg-slate-800/90 text-slate-300 hover:text-white flex-none border border-slate-700/60 ml-1 transition hover:bg-slate-700"
              title="Expandir o colapsar menú"
              aria-label="Expandir o colapsar panel móvil"
            >
              {mobileDrawerHeight === 'collapsed' ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Drawer Content */}
          {mobileDrawerHeight !== 'collapsed' && (
            <div className="flex-1 p-3 overflow-y-auto">
              {activeTab === 'copilot' && (
                <CopilotTab
                  pois={pois}
                  routes={routes}
                  onExecutePlanRoute={handleExecutePlanRoute}
                  onExecuteNearby={handleExecuteNearby}
                  onExecuteHighlightLine={handleExecuteHighlightLine}
                  onExecuteGeofence={handleExecuteGeofence}
                  onExecuteExplorePlaces={handleExecuteExplorePlaces}
                  onNavigateToTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'lines' && (
                <LinesTab
                  routes={routes}
                  visibleRouteIds={visibleRouteIds}
                  highlightedRouteId={highlightedRouteId}
                  onToggleRouteVisibility={handleToggleRouteVisibility}
                  onShowAllRoutes={handleShowAllRoutes}
                  onHideAllRoutes={handleHideAllRoutes}
                  onHighlightRoute={handleHighlightRoute}
                  onZoomToRoute={handleZoomToRoute}
                />
              )}

              {activeTab === 'near' && (
                <NearTab
                  pointP={pointP}
                  nearResults={nearResults}
                  searchRadiusMeters={searchRadiusMeters}
                  isLoading={isLoading}
                  onSetSearchRadius={setSearchRadiusMeters}
                  onUseCurrentLocation={handleLocateUser}
                  onClearPointP={() => setPointP(null)}
                  onHighlightRoute={handleHighlightRoute}
                  onSetPointAs={handleSetPointAs}
                />
              )}

              {activeTab === 'route' && (
                <RoutePlanTab
                  pointA={pointA}
                  pointB={pointB}
                  pointAAddress={pointAAddress}
                  pointBAddress={pointBAddress}
                  routeTarget={routeTarget}
                  trips={trips}
                  activeTrip={activeTrip}
                  isLoading={isLoading}
                  searchRadiusMeters={searchRadiusMeters}
                  maxTransferMeters={maxTransferMeters}
                  enforceDirection={enforceDirection}
                  onSetRouteTarget={setRouteTarget}
                  onSwapPoints={handleSwapPoints}
                  onUseCurrentLocationForA={handleLocateUser}
                  onClearPoint={(t) => (t === 'A' ? setPointA(null) : setPointB(null))}
                  onSelectTrip={setActiveTrip}
                  onUpdateParams={({ searchRadiusMeters: r, maxTransferMeters: m, enforceDirection: e }) => {
                    if (r !== undefined) setSearchRadiusMeters(r);
                    if (m !== undefined) setMaxTransferMeters(m);
                    if (e !== undefined) setEnforceDirection(e);
                  }}
                  onSetGeofenceAlarm={handleOpenGeofenceForTarget}
                  isGeofenceActive={alarmConfig.isActive}
                />
              )}

              {activeTab === 'places' && (
                <PlacesTab
                  pois={pois}
                  selectedPOI={selectedPOI}
                  onSelectPOI={setSelectedPOI}
                  onSetPointAs={handleSetPointAs}
                  onFlyToPOI={(poi) => setSelectedPOI(poi)}
                  onSetGeofenceAlarm={handleOpenGeofenceForTarget}
                />
              )}

              {activeTab === 'dataset' && (
                <DatasetTab
                  stats={stats}
                  isLoading={isLoading}
                  onLoadCustomFile={handleLoadCustomFile}
                  onResetDefaultDataset={loadDefaultDataset}
                />
              )}
            </div>
          )}
        </div>

        {/* Floating Action Buttons */}
        <FloatingActions
          onLocateUser={handleLocateUser}
          onClearMap={handleClearMap}
          onOpenHelp={() => setIsHelpOpen(true)}
          onToggleSidebar={() => {
            setMobileDrawerHeight((prev) => (prev === 'collapsed' ? 'half' : 'collapsed'));
          }}
          isSidebarOpen={mobileDrawerHeight !== 'collapsed'}
          onOpenGeofenceModal={() => setIsGeofenceModalOpen(true)}
          isGeofenceActive={alarmConfig.isActive}
        />

        {/* Active Geofence Floating Banner */}
        <GeofenceActiveBanner
          alarmConfig={alarmConfig}
          onOpenModal={() => setIsGeofenceModalOpen(true)}
          onCancelAlarm={handleDeactivateGeofence}
        />

        {/* Geofence Configuration & Status Modal */}
        <GeofenceModal
          isOpen={isGeofenceModalOpen}
          onClose={() => setIsGeofenceModalOpen(false)}
          alarmConfig={alarmConfig}
          pointB={pointB}
          pointBAddress={pointBAddress}
          pointP={pointP}
          onActivateAlarm={handleActivateGeofence}
          onDeactivateAlarm={handleDeactivateGeofence}
          onSimulateApproach={handleSimulateApproach}
          isSimulating={isSimulatingApproach}
        />

        {/* High Urgency Arrival Alarm Trigger Modal */}
        <GeofenceTriggerModal
          isOpen={alarmConfig.isTriggered}
          targetName={alarmConfig.targetName}
          targetCoords={alarmConfig.targetCoords}
          currentDistanceMeters={alarmConfig.currentDistanceMeters}
          thresholdMeters={alarmConfig.thresholdMeters}
          onStopAlarm={handleStopAlarm}
          onMuteSound={handleMuteSound}
          isSoundMuted={isSoundMuted}
        />

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-slate-900/95 text-slate-100 text-xs font-medium rounded-full shadow-2xl border border-slate-700/80 animate-fade-in flex items-center gap-2 max-w-[90vw] truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-none animate-ping" />
            <span className="truncate">{toastMessage}</span>
          </div>
        )}

        {/* Info & Help Guide Modal */}
        <InfoModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      </div>
    </div>
  );

}
