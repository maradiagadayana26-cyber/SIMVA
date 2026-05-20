import { useState, useEffect } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Car, Fuel, Calendar, Gauge, Zap, AlertTriangle, CheckCircle2, ChevronRight, PenSquare, PlusCircle, Wrench, BookOpen, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { AppDownloadSection } from "../ui/AppDownloadSection";
import { PromotionalBanner } from "../ui/PromotionalBanner";
import { VehicleManuals } from "./VehicleManuals";
import { AIMaintenancePlanner } from "./AIMaintenancePlanner";

export function Dashboard({ onEdit, onShowWorkshops }: { onEdit: (vehicle: any) => void; onShowWorkshops: () => void }) {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicleForManuals, setSelectedVehicleForManuals] = useState<any>(null);
  const [selectedVehicleForAIPlanner, setSelectedVehicleForAIPlanner] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "vehicles"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "vehicles");
    });

    return unsubscribe;
  }, [user]);

  if (loading) return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  if (vehicles.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-full flex-col items-center justify-center p-8 text-center"
      >
        <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Car className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-3xl font-bold font-heading">¡Vaya, el garaje está vacío!</h2>
        <p className="mt-2 text-muted-foreground max-w-md">
          Aún no has registrado ningún vehículo. Registra tu primer coche para empezar a recibir alertas inteligentes.
        </p>
        <Button size="lg" className="mt-8 font-bold text-lg h-14 px-8" onClick={() => onEdit(null)}>
          Registrar mi primer coche
        </Button>
      </motion.div>
    );
  }

  // Helper to calculate maintenance status for a vehicle
  const getMaintenanceStatus = (vehicle: any) => {
    const freq = parseInt(vehicle.maintenanceFrequency) || 15000;
    const kmsSinceLast = vehicle.currentKms - (vehicle.lastMaintenanceKms || 0);
    const ratio = (kmsSinceLast / freq) * 100;
    const remaining = freq - kmsSinceLast;

    let color = "bg-emerald-500";
    let text = "Óptimo";
    let icon = CheckCircle2;
    let status = "Verde";

    if (ratio > 90) {
      color = "bg-red-500";
      text = "¡Crítico!";
      icon = AlertTriangle;
      status = "Rojo";
    } else if (ratio > 70) {
      color = "bg-yellow-500";
      text = "Pronto";
      icon = AlertTriangle;
      status = "Ámbar";
    }

    return { color, text, icon, status, remaining, ratio };
  };

  return (
    <div className="relative p-4 sm:p-8 space-y-8 pb-32 overflow-hidden min-h-full">
      <div className="absolute inset-x-0 top-0 h-[800px] -z-10 road-bg pointer-events-none opacity-25" />
      
      <AppDownloadSection variant="banner" className="rounded-3xl shadow-lg" />

      <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
        <div>
          <h1 className="text-4xl font-black font-heading tracking-tight text-balance flex items-center gap-3">
            <img src="/src/assets/images/simva_logo.png" alt="" className="h-10 w-10 object-contain" />
            SIMVA Garaje
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Bienvenido, {user?.displayName || user?.email?.split('@')[0] || "Usuario"}. Tienes {vehicles.length} {vehicles.length === 1 ? 'vehículo' : 'vehículos'} registrados.
          </p>
        </div>
        <Button onClick={() => onEdit(null)} className="h-12 px-6 font-bold rounded-2xl shadow-lg shadow-primary/20">
          <PlusCircle className="mr-2 h-5 w-5" />
          Añadir Vehículo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {vehicles.map((v) => {
          const status = getMaintenanceStatus(v);
          return (
            <motion.div 
              key={v.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
            <Card className="overflow-hidden border border-white/30 bg-transparent backdrop-blur-md shadow-lg hover:border-primary/50 transition-all group">
                <CardHeader className="bg-white/5 pb-4 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <Car className="h-7 w-7" />
                      </div>
                      <div>
                        <CardTitle className="font-heading text-xl font-black tracking-tight uppercase italic">
                          {v.brand} {v.model}
                        </CardTitle>
                        <CardDescription className="font-bold text-xs">
                          Matrícula: {v.plate || "S/M"} • {v.fuelType} • {v.year}
                        </CardDescription>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-[10px] font-black uppercase tracking-widest ${status.color}`}>
                      <status.icon className="h-3 w-3" />
                      {status.text}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2 tracking-widest">
                          <Gauge className="h-4 w-4" />
                          Mantenimiento Preventivo
                        </span>
                        <span className={`text-xs font-black tracking-tighter ${status.remaining <= 0 ? 'text-red-500' : ''}`}>
                          {status.remaining <= 0 ? 'MANTENIMIENTO VENCIDO' : `${status.remaining.toLocaleString()} km restantes`}
                        </span>
                      </div>
                      <div className="relative h-6 w-full bg-muted rounded-2xl overflow-hidden border">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, status.ratio)}%` }}
                          className={`h-full ${status.color} transition-all duration-1000 shadow-inner`}
                        />
                      </div>
                      
                      {status.status !== "Verde" && (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-4">
                          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-bold text-amber-600 mb-2 uppercase">Atención Requerida</p>
                            <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">Tu vehículo se acerca al intervalo de mantenimiento. Te recomendamos programar una cita pronto.</p>
                            <Button size="sm" onClick={onShowWorkshops} variant="outline" className="h-8 px-3 rounded-lg text-[10px] font-black uppercase border-amber-500/30 hover:bg-amber-500/10 text-amber-600">
                              <Wrench className="h-3 w-3 mr-2" />
                              Ver Talleres
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 justify-center">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="p-3 bg-muted/50 rounded-2xl text-center">
                          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Km Actuales</p>
                          <p className="text-sm font-black italic">{(v.currentKms || 0).toLocaleString()} km</p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-2xl text-center">
                          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">Frecuencia</p>
                          <p className="text-sm font-black italic">{(v.maintenanceFrequency || 0).toLocaleString()} km</p>
                        </div>
                      </div>
                      <Button onClick={() => setSelectedVehicleForAIPlanner(v)} className="h-12 font-bold rounded-xl bg-gradient-to-r from-emerald-500/20 to-primary/20 hover:from-emerald-500/35 hover:to-primary/35 border-2 border-primary/40 text-primary shadow-lg shadow-primary/10">
                        <Sparkles className="mr-2 h-4 w-4 fill-primary/30" />
                        Plan de IA
                      </Button>
                      <Button onClick={() => onEdit(v)} variant="ghost" className="h-11 font-bold rounded-xl text-xs hover:bg-white/5">
                        <PenSquare className="mr-2 h-4 w-4" />
                        Gestionar Vehículo
                      </Button>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t grid grid-cols-4 gap-4">
                    <div className="flex flex-col items-center">
                      <PlusCircle className="h-5 w-5 text-muted-foreground mb-1 group-hover:text-primary transition-colors cursor-pointer" onClick={() => onEdit(v)} />
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Documentos</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <Fuel className="h-5 w-5 text-muted-foreground mb-1 group-hover:text-primary transition-colors hover:scale-110 transition-transform cursor-pointer" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Consumo</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <Wrench className="h-5 w-5 text-muted-foreground mb-1 group-hover:text-primary transition-colors cursor-pointer" onClick={onShowWorkshops} />
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Talleres</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <BookOpen className="h-5 w-5 text-muted-foreground mb-1 group-hover:text-primary transition-colors cursor-pointer" onClick={() => setSelectedVehicleForManuals(v)} />
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Manuales</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <PromotionalBanner />

      <AnimatePresence>
        {selectedVehicleForManuals && (
          <VehicleManuals 
            vehicleId={selectedVehicleForManuals.id} 
            vehicleName={`${selectedVehicleForManuals.brand} ${selectedVehicleForManuals.model}`}
            brand={selectedVehicleForManuals.brand}
            model={selectedVehicleForManuals.model}
            year={selectedVehicleForManuals.year}
            vin={selectedVehicleForManuals.vin}
            onClose={() => setSelectedVehicleForManuals(null)}
          />
        )}
        {selectedVehicleForAIPlanner && (
          <AIMaintenancePlanner
            vehicle={selectedVehicleForAIPlanner}
            onClose={() => setSelectedVehicleForAIPlanner(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


