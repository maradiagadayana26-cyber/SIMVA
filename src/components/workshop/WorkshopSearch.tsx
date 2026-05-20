import { useEffect, useState, useRef, useMemo } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow, 
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary
} from '@vis.gl/react-google-maps';
import { 
  Wrench, 
  MapPin, 
  Navigation, 
  Phone, 
  Star, 
  Clock, 
  ExternalLink,
  Search,
  LocateFixed,
  AlertCircle,
  Heart,
  Bookmark,
  LayoutGrid,
  Fuel,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/contexts/AuthContext';

const API_KEY = (process.env.GOOGLE_MAPS_PLATFORM_KEY as string) || '';
const hasValidKey = Boolean(API_KEY) && 
                   API_KEY !== 'YOUR_API_KEY' && 
                   API_KEY !== 'TU_API_KEY' && 
                   API_KEY.length > 10;

// Console status check for Google Maps Key
if (!hasValidKey) {
  console.warn('⚠️ Google Maps Platform Key no configurada o inválida:', API_KEY ? 'Presente pero muy corta o placeholder' : 'Ausente');
} else {
  console.log('✅ Google Maps Platform Key detectada');
}

// --- Components ---

function MarkerWithInfoWindow({ 
  place, 
  onNavigate, 
  isSaved, 
  onToggleSave, 
  ...props 
}: { 
  place: any; 
  onNavigate: (lat: number, lng: number, name: string) => void;
  isSaved: boolean;
  onToggleSave: (place: any) => void;
  [key: string]: any;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  if (!place.location) return null;

  const isGasStation = (place.types || place.includedPrimaryTypes || []).includes('gas_station') || place.placeType === 'gasolinera';
  const displayTitle = typeof place.displayName === 'object' ? place.displayName.text : (place.displayName || place.name || (isGasStation ? 'Gasolinera' : 'Taller'));

  return (
    <>
      <AdvancedMarker 
        ref={markerRef} 
        position={place.location} 
        onClick={() => setOpen(true)}
        {...props}
      >
        <div className="group relative" id={`marker-${place.id || place.placeId}`}>
          <div className={cn(
            "absolute -inset-2 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity",
            isGasStation ? "bg-green-500/20" : "bg-primary/20"
          )} />
          <div className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 backdrop-blur-md transition-all shadow-xl",
            open 
              ? (isGasStation ? "bg-green-500 border-green-500" : "bg-primary border-primary") + " scale-110 shadow-black/40" 
              : "bg-black/40" + (isGasStation ? " hover:border-green-500" : " hover:border-primary")
          )}>
            {isGasStation ? (
              <Fuel className={cn("h-5 w-5", open ? "text-black" : "text-green-500")} />
            ) : (
              <Wrench className={cn("h-5 w-5", open ? "text-black" : "text-primary")} />
            )}
          </div>
        </div>
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-2 max-w-[200px] text-black font-sans">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-sm leading-tight pr-4">{displayTitle}</h4>
              <motion.button
                whileTap={{ scale: 0.8 }}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-black/5 shrink-0 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave(place);
                }}
              >
                <Heart className={cn("h-4 w-4", isSaved ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
              </motion.button>
            </div>
            <div className="flex items-center gap-1 mb-2">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-bold">{place.rating || 'N/A'}</span>
            </div>
            <p className="text-[10px] line-clamp-2 text-muted-foreground mb-3">{place.formattedAddress || place.address}</p>
            <Button 
              size="sm" 
              className={cn("w-full h-8 rounded-lg text-xs font-bold", isGasStation ? "bg-green-500 hover:bg-green-600 focus:ring-green-500/20" : "bg-primary hover:bg-primary/90 focus:ring-primary/20")}
              onClick={() => {
                const loc = place.location;
                if (loc) {
                  const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
                  const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
                  onNavigate(lat, lng, displayTitle);
                }
              }}
            >
              <Navigation className="h-3 w-3 mr-1" />
              Navegar
            </Button>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function WorkshopList({ 
  workshops, 
  onSelect, 
  onNavigate,
  savedPlaceIds, 
  onToggleSave,
  selectedPlaceId
}: { 
  workshops: any[]; 
  onSelect: (place: any) => void;
  onNavigate: (lat: number, lng: number, name: string) => void;
  savedPlaceIds: Set<string>;
  onToggleSave: (place: any) => void;
  selectedPlaceId?: string | null;
}) {
  if (workshops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <Search className="h-8 w-8 text-muted-foreground/30" />
        </div>
        <h3 className="font-bold text-lg">No se encontraron resultados</h3>
        <p className="text-sm text-muted-foreground">Prueba a cambiar los filtros o el radio de búsqueda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {workshops.map((place) => {
        const id = place.id || place.placeId;
        const isSaved = savedPlaceIds.has(id);
        const name = typeof place.displayName === 'object' ? place.displayName.text : (place.displayName || place.name);
        const address = place.formattedAddress || place.address;
        const isGasStation = (place.types || place.includedPrimaryTypes || []).includes('gas_station') || place.placeType === 'gasolinera';

        return (
          <Card 
            key={id} 
            id={`workshop-card-${id}`}
            className={cn(
              "group p-4 bg-transparent backdrop-blur-md hover:bg-white/10 border border-white/30 transition-all cursor-pointer rounded-2xl",
              selectedPlaceId === id 
                ? (isGasStation ? "border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20" : "border-primary bg-primary/10 shadow-lg shadow-primary/20") 
                : "shadow-sm"
            )}
            onClick={(e) => {
              onSelect(place);
              e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className={cn(
                "font-bold text-sm transition-colors leading-tight pr-4",
                isGasStation ? "group-hover:text-green-500" : "group-hover:text-primary"
              )}>
                {name}
              </h4>
              <motion.button 
                whileTap={{ scale: 0.8 }}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10 shrink-0 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave(place);
                }}
              >
                <Heart className={cn("h-4 w-4 transition-colors", isSaved ? "fill-red-500 text-red-500" : "text-muted-foreground group-hover:text-red-500/50")} />
              </motion.button>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-bold">{place.rating || 'N/A'}</span>
              </div>
              {place.userRatingCount && (
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                  • {place.userRatingCount} Reseñas
                </span>
              )}
              {place.priceLevel && isGasStation && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/5",
                  place.priceLevel === 'PRICE_LEVEL_MODERATE' ? "text-amber-500" : "text-green-500"
                )}>
                  {place.priceLevel === 'PRICE_LEVEL_INEXPENSIVE' ? '€' : place.priceLevel === 'PRICE_LEVEL_MODERATE' ? '€€' : '€€€'}
                </span>
              )}
              <Badge 
                variant="outline" 
                className={cn(
                  "ml-auto text-[10px] h-5 px-2 py-0",
                  isGasStation 
                    ? "bg-green-500/5 text-green-500 border-green-500/20" 
                    : "bg-primary/5 text-primary border-primary/20"
                )}
              >
                {isGasStation ? '⛽ Gasolinera' : '🔧 Taller'}
              </Badge>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-[10px] text-muted-foreground leading-relaxed flex items-start gap-2">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{address}</span>
              </p>
              
              {place.regularOpeningHours && (
                <div className="flex items-start gap-2">
                  <Clock className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col gap-0.5">
                    <span className={cn(
                      "text-[10px] font-bold",
                      place.regularOpeningHours.openNow ? "text-green-500" : "text-red-500"
                    )}>
                      {place.regularOpeningHours.openNow ? 'Abierto ahora' : 'Cerrado'}
                    </span>
                    {place.regularOpeningHours.weekdayDescriptions?.[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] && (
                      <span className="text-[9px] text-muted-foreground/60 uppercase tracking-tighter">
                        {place.regularOpeningHours.weekdayDescriptions[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 h-9 rounded-xl text-[10px] font-bold border-white/10 hover:bg-white/5" 
                onClick={(e) => {
                  e.stopPropagation();
                  const phone = place.nationalPhoneNumber || place.phoneNumber;
                  if (phone) window.open(`tel:${phone}`);
                  else toast.info("No hay teléfono disponible");
                }}
              >
                <Phone className="h-3 w-3 mr-1.5" />
                Llamar
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="flex-1 h-9 rounded-xl text-[10px] font-bold border-white/10 hover:bg-white/5" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const loc = place.location;
                  if (loc) {
                    const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
                    const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
                    onNavigate(lat, lng, name);
                  }
                }}
              >
                <Navigation className="h-3 w-3 mr-1.5 text-primary" />
                Ruta
              </Button>
              <Button 
                size="sm" 
                className={cn("flex-1 h-9 rounded-xl text-[10px] font-bold", isGasStation ? "bg-green-500 text-black hover:bg-green-600" : "bg-primary text-black hover:bg-primary/90")} 
                onClick={(e) => { e.stopPropagation(); onSelect(place); }}
              >
                <MapPin className="h-3 w-3 mr-1.5" />
                Mapa
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

const WorkshopSearchInner = () => {
  const { user } = useAuth();
  const placesLib = useMapsLibrary('places');
  const map = useMap();
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [savedWorkshops, setSavedWorkshops] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'search' | 'saved'>('search');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isKeyValid, setIsKeyValid] = useState<boolean | null>(null);
  
  // New Filters
  const [showWorkshops, setShowWorkshops] = useState(true);
  const [showGasStations, setShowGasStations] = useState(true);

  // Validate API Key from server
  useEffect(() => {
    const validateKey = async () => {
      try {
        const response = await fetch('/api/validate-map-key');
        const data = await response.json();
        setIsKeyValid(data.valid);
        if (!data.valid) {
          setError(data.message || "La clave de Google Maps no es válida.");
        }
      } catch (err) {
        console.error("Error validating API key:", err);
        setIsKeyValid(false);
        setError("Error de red al validar el servicio de mapas.");
      }
    };
    validateKey();
  }, []);

  // Load saved workshops from Firestore
  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}/saved_workshops`;
    const q = query(collection(db, path), orderBy('savedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const saved = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      }));
      setSavedWorkshops(saved);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          if (map) map.setCenter(loc);
        },
        (err) => {
          console.error(err);
          let msg = "No se pudo obtener tu ubicación.";
          if (err.code === 1) {
            msg = "Permiso de ubicación denegado. Por favor, habilita el acceso en la configuración de tu navegador para ver talleres cercanos.";
          } else if (err.code === 2) {
            msg = "Tu ubicación actual no está disponible. Asegúrate de tener el GPS activado y buena señal de red.";
          } else if (err.code === 3) {
            msg = "Se agotó el tiempo de espera para obtener tu ubicación. Intenta recargar la página.";
          }
          setError(msg);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    } else {
      setError("Tu navegador no es compatible con el sistema de geolocalización de SIMVA.");
      setLoading(false);
    }
  }, [map]);

  const searchNearbyPlaces = async (location: google.maps.LatLngLiteral) => {
    if (!placesLib || !map) return;
    
    const includedTypes = [];
    if (showWorkshops) includedTypes.push('car_repair');
    if (showGasStations) includedTypes.push('gas_station');

    if (includedTypes.length === 0) {
      setWorkshops([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const { places } = await placesLib.Place.searchNearby({
        locationRestriction: {
          center: location,
          radius: 5000, // 5km as requested
        },
        includedPrimaryTypes: includedTypes,
        fields: [
          'id', 
          'displayName', 
          'location', 
          'formattedAddress', 
          'rating', 
          'userRatingCount', 
          'regularOpeningHours',
          'nationalPhoneNumber',
          'websiteUri',
          'types',
          'priceLevel'
        ],
        maxResultCount: 20,
      });
      
      setWorkshops(places);
      
      if (places.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        places.forEach(p => p.location && bounds.extend(p.location));
        map.fitBounds(bounds, 50);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al buscar lugares cercanos");
    } finally {
      setSearching(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userLocation && placesLib && map && isKeyValid) {
      searchNearbyPlaces(userLocation);
    }
  }, [userLocation, placesLib, map, showWorkshops, showGasStations, isKeyValid]);

  const handleNavigate = (lat: number, lng: number, name: string) => {
    const wazeUrl = `waze://?ll=${lat},${lng}&navigate=yes`;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      // Try Waze first, fallback to Google Maps
      window.location.href = wazeUrl;
      setTimeout(() => {
        window.open(googleMapsUrl, '_blank');
      }, 500);
    } else {
      window.open(googleMapsUrl, '_blank');
    }
  };

  const toggleSave = async (place: any) => {
    if (!user) {
      toast.error("Inicia sesión para guardar lugares");
      return;
    }

    const id = place.id || place.placeId;
    const isCurrentlySaved = savedWorkshops.some(sw => sw.placeId === id);
    const path = `users/${user.uid}/saved_workshops`;

    try {
      if (isCurrentlySaved) {
        await deleteDoc(doc(db, path, id));
        toast.success("Lugar eliminado de guardados");
      } else {
        const loc = place.location;
        const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
        const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;

        // Extract complex objects if they exist (standardize for Firestore)
        const standardizedName = typeof place.displayName === 'object' ? place.displayName.text : (place.displayName || place.name);
        const standardizedAddress = place.formattedAddress || place.address;
        const placePhone = place.nationalPhoneNumber || place.phoneNumber || null;
        
        // Handle opening hours if available
        let openingHoursData = null;
        if (place.regularOpeningHours) {
          openingHoursData = {
            openNow: place.regularOpeningHours.openNow || false,
            weekdayDescriptions: place.regularOpeningHours.weekdayDescriptions || []
          };
        }

        await setDoc(doc(db, path, id), {
          userId: user.uid,
          placeId: id,
          name: standardizedName,
          address: standardizedAddress,
          phoneNumber: placePhone,
          rating: place.rating || null,
          userRatingCount: place.userRatingCount || null,
          priceLevel: place.priceLevel || null,
          location: { lat, lng },
          regularOpeningHours: openingHoursData,
          websiteUri: place.websiteUri || null,
          placeType: (place.types || place.includedPrimaryTypes || []).includes('gas_station') ? 'gasolinera' : 'taller',
          savedAt: serverTimestamp(),
        });
        toast.success("Lugar guardado en Favoritos");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const savedPlaceIds: Set<string> = new Set(savedWorkshops.map(sw => sw.placeId));

  if (loading && !error) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 bg-background h-screen">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 animate-ping rounded-full" />
          <div className="relative h-20 w-20 rounded-3xl bg-black border-2 border-primary flex items-center justify-center shadow-xl">
            <Search className="h-10 w-10 text-primary animate-pulse" />
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black italic uppercase tracking-tighter italic text-white">Simva está buscando</h2>
          <p className="text-sm text-muted-foreground">Localizando puntos de interés cercanos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isApiKeyError = error.includes("clave") || error.includes("API") || error.includes("restringida") || error.includes("Configuración") || error.includes("sistema");
    const isPermissionError = error.includes("permisos") || error.includes("denegado") || error.includes("ubicación");

    return (
      <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto h-screen space-y-8 bg-background font-sans">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="h-24 w-24 rounded-[2.5rem] bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center shadow-2xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-red-500/5 animate-pulse" />
          <AlertCircle className="h-12 w-12 text-red-500 relative z-10" />
        </motion.div>

        <div className="space-y-4">
          <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white">
            {isApiKeyError ? "Error de Configuración" : isPermissionError ? "Acceso de Ubicación" : "Error de Red"}
          </h3>
          
          <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4 text-left">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {error}
            </p>
            
            {isPermissionError && (
              <div className="space-y-3 border-t border-white/5 pt-4">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Cómo habilitar permisos:</p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 h-4 w-4 rounded-full bg-primary text-black flex items-center justify-center text-[8px] font-bold">1</span>
                    <p className="text-[10px] text-muted-foreground">Haz clic en el icono del <b>candado</b> o <b>configuración</b> a la izquierda de la URL en tu navegador.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 h-4 w-4 rounded-full bg-primary text-black flex items-center justify-center text-[8px] font-bold">2</span>
                    <p className="text-[10px] text-muted-foreground">Localiza "Ubicación" y selecciona <b>Permitir</b>.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 h-4 w-4 rounded-full bg-primary text-black flex items-center justify-center text-[8px] font-bold">3</span>
                    <p className="text-[10px] text-muted-foreground">Si estás en un dispositivo móvil, revisa <b>Ajustes {'>'} Privacidad {'>'} Localización</b>.</p>
                  </div>
                </div>
              </div>
            )}

            {isApiKeyError && (
              <div className="space-y-3 border-t border-white/5 pt-4">
                <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Guía de Configuración de API Key:</p>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 h-4 w-4 rounded-full bg-amber-500 text-black flex items-center justify-center text-[8px] font-bold">1</span>
                    <p className="text-[10px] text-muted-foreground">Obtén tu clave en <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener" className="text-amber-500 hover:underline font-bold">Google Maps Platform</a>.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 h-4 w-4 rounded-full bg-amber-500 text-black flex items-center justify-center text-[8px] font-bold">2</span>
                    <p className="text-[10px] text-muted-foreground">Habilita <b>Maps JavaScript API</b> y <b>Places API (New)</b> en tu proyecto de Cloud Console.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-shrink-0 h-4 w-4 rounded-full bg-amber-500 text-black flex items-center justify-center text-[8px] font-bold">3</span>
                    <p className="text-[10px] text-muted-foreground">Configura la variable <code className="bg-white/10 px-1 rounded">GOOGLE_MAPS_PLATFORM_KEY</code> en tu entorno de despliegue.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col w-full gap-3">
          <Button 
            className="rounded-2xl bg-white text-black h-12 font-black italic uppercase tracking-tight hover:bg-white/90 shadow-xl"
            onClick={() => window.location.reload()}
          >
            Actualizar y Reintentar
          </Button>
          {!isApiKeyError && (
            <Button 
              variant="ghost"
              className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest hover:text-white"
              onClick={() => {
                setError(null);
                setLoading(true);
                window.location.reload();
              }}
            >
              Ignorar y Forzar Carga
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-background">
      {/* Sidebar for list */}
      <div className="w-full lg:w-[400px] flex flex-col border-r bg-black/40 backdrop-blur-xl shrink-0 h-[400px] lg:h-full z-10 transition-all shadow-2xl lg:shadow-none font-sans">
        <div className="p-6 border-b border-white/5 bg-black/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Navigation className="h-6 w-6 text-black" />
              </div>
              <div>
                <h2 className="font-heading text-xl font-black italic uppercase tracking-tight text-white">Talleres Cercanos</h2>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-none">Red de Servicios SIMVA</p>
              </div>
            </div>
            {userLocation && (
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn("rounded-xl border border-white/5 hover:bg-white/10", searching && "animate-spin")}
                onClick={() => searchNearbyPlaces(userLocation)}
              >
                <LocateFixed className="h-4 w-4 text-white" />
              </Button>
            )}
          </div>
          
          <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5 mb-4 shadow-inner">
            <Button 
              variant="ghost" 
              className={cn(
                "flex-1 h-9 rounded-lg text-[10px] font-black uppercase tracking-widest italic transition-all",
                viewMode === 'search' ? "bg-primary text-black shadow-md" : "text-muted-foreground hover:bg-white/5"
              )}
              onClick={() => setViewMode('search')}
            >
              <Search className="h-3 w-3 mr-2" />
              Cercanos
            </Button>
            <Button 
              variant="ghost" 
              className={cn(
                "flex-1 h-9 rounded-lg text-[10px] font-black uppercase tracking-widest italic transition-all",
                viewMode === 'saved' ? "bg-primary text-black shadow-md" : "text-muted-foreground hover:bg-white/5"
              )}
              onClick={() => setViewMode('saved')}
            >
              <Heart className="h-3 w-3 mr-2" />
              Guardados
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Red de Servicios</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowWorkshops(!showWorkshops)}
                className={cn(
                  "relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-300 overflow-hidden group",
                  showWorkshops 
                    ? "bg-primary/10 border-primary shadow-lg shadow-primary/10" 
                    : "bg-white/5 border-transparent hover:border-white/10 opacity-60"
                )}
              >
                {showWorkshops && (
                  <motion.div 
                    layoutId="active-bg-workshop"
                    className="absolute inset-0 bg-primary/5 animate-pulse" 
                  />
                )}
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center mb-2 transition-colors",
                  showWorkshops ? "bg-primary text-black" : "bg-white/5 text-muted-foreground"
                )}>
                  <Wrench className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-wider italic",
                  showWorkshops ? "text-primary" : "text-muted-foreground"
                )}>
                  Talleres
                </span>
                {showWorkshops && (
                  <span className="absolute top-2 right-2 flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                  </span>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowGasStations(!showGasStations)}
                className={cn(
                  "relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-300 overflow-hidden group",
                  showGasStations 
                    ? "bg-green-500/10 border-green-500 shadow-lg shadow-green-500/10" 
                    : "bg-white/5 border-transparent hover:border-white/10 opacity-60"
                )}
              >
                {showGasStations && (
                  <motion.div 
                    layoutId="active-bg-gas"
                    className="absolute inset-0 bg-green-500/5 animate-pulse" 
                  />
                )}
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center mb-2 transition-colors",
                  showGasStations ? "bg-green-500 text-black" : "bg-white/5 text-muted-foreground"
                )}>
                  <Fuel className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-wider italic",
                  showGasStations ? "text-green-500" : "text-muted-foreground"
                )}>
                  Surtidores
                </span>
                {showGasStations && (
                  <span className="absolute top-2 right-2 flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                  </span>
                )}
              </motion.button>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <WorkshopList 
            workshops={viewMode === 'search' ? workshops : savedWorkshops} 
            savedPlaceIds={savedPlaceIds}
            onToggleSave={toggleSave}
            onNavigate={handleNavigate}
            selectedPlaceId={selectedPlaceId}
            onSelect={(p) => {
              const id = p.id || p.placeId;
              setSelectedPlaceId(id);
              const loc = p.location;
              if (loc) {
                const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
                const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
                map?.panTo({ lat, lng });
                map?.setZoom(16);
              }
            }} 
          />
        </ScrollArea>

        <div className="p-6 border-t border-white/5 bg-black/60">
          <div className="flex items-center gap-2 mb-2 p-3 rounded-xl bg-primary/5 border border-primary/10 shadow-sm">
            <LocateFixed className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-bold text-primary italic uppercase leading-none">Simva Navigation System</p>
          </div>
          <p className="text-[10px] text-muted-foreground italic px-1 leading-relaxed">
            {viewMode === 'search' 
              ? "Nuestros leones han verificado los talleres y gasolineras más cercanos a tu ubicación."
              : "Aquí tienes los lugares que has guardado para tus próximas paradas."}
          </p>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative bg-black h-full min-h-[300px]">
        <Map
          defaultCenter={userLocation || { lat: 0, lng: 0 }}
          defaultZoom={13}
          mapId="SIMVA_NAV_MAP"
          disableDefaultUI
          zoomControl
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          className="w-full h-full"
        >
          {userLocation && (
            <AdvancedMarker position={userLocation}>
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 animate-ping rounded-full opacity-50" />
                <div className="h-6 w-6 bg-blue-600 rounded-full border-2 border-white shadow-xl relative z-10" />
              </div>
            </AdvancedMarker>
          )}

          {(viewMode === 'search' ? workshops : savedWorkshops).map(p => (
            <MarkerWithInfoWindow 
              key={p.id || p.placeId} 
              place={p} 
              onNavigate={handleNavigate}
              isSaved={savedPlaceIds.has(p.id || p.placeId)}
              onToggleSave={toggleSave}
            />
          ))}
        </Map>
        
        {searching && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/80 backdrop-blur-xl border border-primary/20 rounded-full flex items-center gap-3 shadow-2xl z-20">
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary italic">Escaneando zona...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export function WorkshopSearch() {
  if (!hasValidKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-[#0F1115] text-white font-sans">
        <div className="max-w-md space-y-8">
          <div className="h-24 w-24 mx-auto rounded-[2rem] bg-gray-900 border-2 border-white/10 flex items-center justify-center shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-amber-500/10 animate-pulse" />
            <AlertCircle className="h-12 w-12 text-amber-500 relative z-10" />
          </div>
          
          <div className="space-y-3">
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">Motor Desactivado</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              La Red SIMVA requiere una llave de acceso para los sistemas de posicionamiento global.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-6 text-left">
            <div className="space-y-4">
              <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Cómo activar los Mapas:</p>
              
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold">1</div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">Crea una API Key</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Entra en <a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener" className="text-amber-500 hover:underline">Google Cloud Console</a> y genera una nueva clave.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold">2</div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">Vincula el entorno</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Añade la variable <code className="bg-white/10 px-1 rounded">GOOGLE_MAPS_PLATFORM_KEY</code> en los ajustes de tu aplicación.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold">3</div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">Habilita servicios</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Asegúrate de que <b>Maps JavaScript API</b> y <b>Places API</b> estén "Enabled".
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black pt-4 border-t border-white/5 italic">
              SIMVA – Inteligencia Automotriz
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden">
      <APIProvider 
        apiKey={API_KEY} 
        version="weekly" 
        libraries={['places']} 
        language="es"
      >
        <WorkshopSearchInner />
      </APIProvider>
    </div>
  );
}
