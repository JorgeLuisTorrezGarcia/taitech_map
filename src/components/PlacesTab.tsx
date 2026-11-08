import React, { useMemo, useState, useRef } from 'react';
import { Coordinates, POIItem } from '../types.ts';
import {
  Search,
  MapPin,
  Building,
  GraduationCap,
  ShoppingBag,
  Hospital,
  Store,
  Bus,
  X,
  ChevronLeft,
  ChevronRight,
  BellRing,
} from 'lucide-react';

interface PlacesTabProps {
  pois: POIItem[];
  selectedPOI: POIItem | null;
  onSelectPOI: (poi: POIItem) => void;
  onSetPointAs: (type: 'A' | 'B', coords: Coordinates, name: string) => void;
  onFlyToPOI: (poi: POIItem) => void;
  onSetGeofenceAlarm?: (coords: Coordinates, name: string) => void;
}

export const PlacesTab: React.FC<PlacesTabProps> = ({
  pois,
  selectedPOI,
  onSelectPOI,
  onSetPointAs,
  onFlyToPOI,
  onSetGeofenceAlarm,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  // Mouse drag-to-scroll state
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // Categories present in POIs
  const categories = useMemo(() => {
    const set = new Set<string>();
    pois.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['Todos', ...Array.from(set)];
  }, [pois]);

  const filteredPOIs = useMemo(() => {
    return pois.filter((poi) => {
      const matchesCat =
        selectedCategory === 'Todos' || poi.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        poi.name.toLowerCase().includes(q) ||
        (poi.dir && poi.dir.toLowerCase().includes(q)) ||
        (poi.desc && poi.desc.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [pois, selectedCategory, searchQuery]);

  const getCategoryIcon = (category: string) => {
    if (category.includes('Universidad')) return <GraduationCap className="w-3.5 h-3.5 text-blue-400" />;
    if (category.includes('Comercial')) return <ShoppingBag className="w-3.5 h-3.5 text-pink-400" />;
    if (category.includes('Salud') || category.includes('Hospital')) return <Hospital className="w-3.5 h-3.5 text-rose-400" />;
    if (category.includes('Mercado')) return <Store className="w-3.5 h-3.5 text-amber-400" />;
    if (category.includes('Transporte')) return <Bus className="w-3.5 h-3.5 text-emerald-400" />;
    return <Building className="w-3.5 h-3.5 text-indigo-400" />;
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesScrollRef.current) {
      const offset = direction === 'left' ? -180 : 180;
      categoriesScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!categoriesScrollRef.current) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - categoriesScrollRef.current.offsetLeft;
    scrollLeftRef.current = categoriesScrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !categoriesScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - categoriesScrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    categoriesScrollRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar universidad, mercado, hospital (ej. UAGRM, Ventura)..."
          className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Category Chips Scroll Carousel with Move Toggles */}
      <div className="relative flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => scrollCategories('left')}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition shrink-0 shadow-sm active:scale-95"
          aria-label="Desplazar categorías hacia la izquierda"
          title="Ver categorías anteriores"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <div
          ref={categoriesScrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="flex items-center gap-1.5 overflow-x-auto py-0.5 scroll-smooth no-scrollbar touch-pan-x flex-1 min-w-0 select-none cursor-grab active:cursor-grabbing"
        >
          {categories.map((cat) => {
            const count =
              cat === 'Todos'
                ? pois.length
                : pois.filter((p) => p.category === cat).length;
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0 transition border text-xs font-medium flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-1 ring-emerald-400/40'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                }`}
              >
                {cat !== 'Todos' && getCategoryIcon(cat)}
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isSelected
                      ? 'bg-emerald-700/80 text-emerald-100'
                      : 'bg-slate-700/70 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollCategories('right')}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition shrink-0 shadow-sm active:scale-95"
          aria-label="Desplazar categorías hacia la derecha"
          title="Ver más categorías"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* POI List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
        {filteredPOIs.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400">
            <Building className="w-10 h-10 mx-auto text-slate-600 mb-2 stroke-1" />
            <p className="font-medium text-slate-300">No se encontraron lugares</p>
            <p className="text-xs mt-1">Prueba con otro término o selecciona "Todos".</p>
          </div>
        ) : (
          filteredPOIs.map((poi) => {
            const isSelected = selectedPOI?.id === poi.id;

            return (
              <div
                key={poi.id}
                onClick={() => {
                  onSelectPOI(poi);
                  onFlyToPOI(poi);
                }}
                className={`p-2.5 rounded-xl border transition cursor-pointer select-none space-y-2 ${
                  isSelected
                    ? 'bg-slate-800 border-indigo-500/80 ring-1 ring-indigo-500/40 shadow-md'
                    : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {getCategoryIcon(poi.category)}
                      <span className="font-semibold text-sm text-slate-100 truncate">
                        {poi.name}
                      </span>
                    </div>
                    {poi.dir && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        📍 {poi.dir}
                      </p>
                    )}
                    {poi.desc && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                        {poi.desc}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 whitespace-nowrap">
                    {poi.category}
                  </span>
                </div>

                {/* Quick actions: Fly, Set A, Set B, Geofence Alarm */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-700/50 text-xs flex-wrap gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFlyToPOI(poi);
                    }}
                    className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-white"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Ver mapa</span>
                  </button>

                  <div className="flex items-center gap-1.5 ml-auto">
                    {onSetGeofenceAlarm && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetGeofenceAlarm([poi.lon, poi.lat], poi.name);
                        }}
                        className="px-2 py-0.5 rounded bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 text-[11px] font-medium transition flex items-center gap-1"
                        title="Activar alarma de bajada para este lugar"
                      >
                        <BellRing className="w-3 h-3 text-amber-400" />
                        <span>Avisarme</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetPointAs('A', [poi.lon, poi.lat], poi.name);
                      }}
                      className="px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[11px] font-medium transition"
                    >
                      Como A
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetPointAs('B', [poi.lon, poi.lat], poi.name);
                      }}
                      className="px-2 py-0.5 rounded bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[11px] font-medium transition"
                    >
                      Como B
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

