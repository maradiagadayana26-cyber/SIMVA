import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Gauge, Sparkles, Wrench, AlertTriangle, CheckCircle, ChevronRight, HelpCircle, ExternalLink, RefreshCw, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import axios from "axios";
import { db } from "@/src/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";

interface AIMaintenancePlannerProps {
  vehicle: any;
  onClose: () => void;
}

export function AIMaintenancePlanner({ vehicle, onClose }: AIMaintenancePlannerProps) {
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [intervals, setIntervals] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);

  // Form states pre-filled from vehicle data
  const [currentKms, setCurrentKms] = useState(vehicle?.currentKms?.toString() || "");
  const [lastOilChangeKms, setLastOilChangeKms] = useState(vehicle?.lastMaintenanceKms?.toString() || "");
  const [lastFilterChangeKms, setLastFilterChangeKms] = useState(vehicle?.lastMaintenanceKms?.toString() || "");
  const [lastTireChangeKms, setLastTireChangeKms] = useState("");

  const steps = [
    "SIMVA está abriendo canal seguro con la IA...",
    "Buscando el manual oficial del fabricante en la web...",
    "Extrayendo intervalos oficiales de mantenimiento...",
    "Calculando plan personalizado de mantenimiento..."
  ];

  // Rotate loading steps while searching
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % steps.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Try to load any previous maintenance logs from Firestore to prefill last changes
  useEffect(() => {
    async function loadPrefillFromLogs() {
      if (!vehicle?.id) return;
      try {
        const q = query(
          collection(db, "vehicles", vehicle.id, "maintenance_history"),
          orderBy("kilometers", "desc")
        );
        const snap = await getDocs(q);
        const logs = snap.docs.map(d => d.data());
        
        // Find last oil change
        const lastOilLog = logs.find(log => 
          log.serviceType?.toLowerCase().includes("aceite") || 
          log.serviceType?.toLowerCase().includes("oil")
        );
        if (lastOilLog) {
          setLastOilChangeKms(lastOilLog.kilometers?.toString());
        }

        // Find last filter change
        const lastFilterLog = logs.find(log => 
          log.serviceType?.toLowerCase().includes("filtro") || 
          log.serviceType?.toLowerCase().includes("filter")
        );
        if (lastFilterLog) {
          setLastFilterChangeKms(lastFilterLog.kilometers?.toString());
        }

        // Find last tire change
        const lastTireLog = logs.find(log => 
          log.serviceType?.toLowerCase().includes("neumático") || 
          log.serviceType?.toLowerCase().includes("rueda") || 
          log.serviceType?.toLowerCase().includes("tire") || 
          log.serviceType?.toLowerCase().includes("ruedas")
        );
        if (lastTireLog) {
          setLastTireChangeKms(lastTireLog.kilometers?.toString());
        }
      } catch (err) {
        console.error("Error reading logs for prefill:", err);
      }
    }
    loadPrefillFromLogs();
  }, [vehicle]);

  const handleComputeAIPlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setLoadingStep(0);
    try {
      const response = await axios.post("/api/vehicles/ai-maintenance", {
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        fuelType: vehicle.fuelType,
        currentKms: Number(currentKms) || 0,
        lastOilChangeKms: lastOilChangeKms ? Number(lastOilChangeKms) : null,
        lastFilterChangeKms: lastFilterChangeKms ? Number(lastFilterChangeKms) : null,
        lastTireChangeKms: lastTireChangeKms ? Number(lastTireChangeKms) : null
      });

      if (response.data.success) {
        setIntervals(response.data.intervals);
        setUpcoming(response.data.upcoming);
        toast.success("¡Plan de mantenimiento de IA generado!");
      } else {
        toast.error("Error al calcular el plan con la IA.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Ocurrió un error al contactar con la IA de SIMVA.");
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadgeColor = (prio: string) => {
    switch (prio) {
      case "alta":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "media":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-card border-2 border-white/20 rounded-3xl overflow-hidden shadow-2xl my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-white/5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-xl text-primary animate-pulse">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight font-heading flex items-center gap-1.5">
                Plan de Mantenimiento por IA <span className="text-xs bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full italic font-bold">Beta</span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Búsqueda en internet en tiempo real del manual de {vehicle.brand} {vehicle.model} ({vehicle.year})
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10 h-10 w-10">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
              <div className="relative flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary"></div>
                <Sparkles className="absolute h-6 w-6 text-primary animate-bounce" />
              </div>
              <div className="space-y-2 max-w-md">
                <p className="font-heading font-black text-lg text-white tracking-wide uppercase italic">
                  {steps[loadingStep]}
                </p>
                <p className="text-xs text-muted-foreground">
                  Nuestra red neuronal está contrastando información técnica del fabricante para ofrecerte los intervalos garantizados más fiables y evitar accidentes.
                </p>
              </div>
            </div>
          ) : !intervals ? (
            <form onSubmit={handleComputeAIPlan} className="space-y-6">
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-extrabold text-white">¿Cómo funciona?</span> La IA buscará en la web el manual oficial del plan de revisión correspondiente a tu modelo y año. Al especificar los kilómetros del último cambio, calcularemos con exactitud los kilómetros restantes en futuros hitos.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest italic text-muted-foreground">
                    Kilómetros actuales del vehículo
                  </Label>
                  <div className="relative">
                    <Gauge className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Ej. 15000"
                      value={currentKms}
                      onChange={(e) => setCurrentKms(e.target.value)}
                      className="pl-10 h-11 border-2 font-bold focus:border-primary"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest italic text-muted-foreground col-span-1">
                    Último cambio de aceite (Km)
                  </Label>
                  <div className="relative">
                    <Wrench className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Ej. 10000 (deja vacío si no lo conoces)"
                      value={lastOilChangeKms}
                      onChange={(e) => setLastOilChangeKms(e.target.value)}
                      className="pl-10 h-11 border-2 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest italic text-muted-foreground">
                    Último cambio de filtros de aceite o aire (Km)
                  </Label>
                  <div className="relative">
                    <Wrench className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Ej. 10000 (deja vacío si no lo conoces)"
                      value={lastFilterChangeKms}
                      onChange={(e) => setLastFilterChangeKms(e.target.value)}
                      className="pl-10 h-11 border-2 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest italic text-muted-foreground">
                    Último cambio de neumáticos (Km)
                  </Label>
                  <div className="relative">
                    <Wrench className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Ej. 0 (Original de fábrica)"
                      value={lastTireChangeKms}
                      onChange={(e) => setLastTireChangeKms(e.target.value)}
                      className="pl-10 h-11 border-2 font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" size="lg" className="h-12 px-8 font-black rounded-xl">
                  <Sparkles className="mr-2 h-5 w-5 text-emerald-300 fill-emerald-300" />
                  Iniciar Búsqueda por IA
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-8">
              {/* Intervals Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border border-white/20 bg-white/5 shadow-md">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-[10px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-1.5">
                      <Gauge className="h-4.5 w-4.5 text-primary" /> Aceite Motor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xl font-black italic text-white">
                      {intervals.oil_change_km ? `${intervals.oil_change_km.toLocaleString()} km` : "No det."}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      O cada {intervals.oil_change_months || 12} meses
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-white/20 bg-white/5 shadow-md">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-[10px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-1.5">
                      <Wrench className="h-4.5 w-4.5 text-primary" /> Filtros Aire/Aceite
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xl font-black italic text-white">
                      {intervals.filter_change_km ? `${intervals.filter_change_km.toLocaleString()} km` : "No det."}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Sugerido en cada cambio de aceite
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-white/20 bg-white/5 shadow-md">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-[10px] uppercase font-black text-muted-foreground tracking-widest flex items-center gap-1.5">
                      <Calendar className="h-4.5 w-4.5 text-primary" /> Neumáticos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xl font-black italic text-white">
                      {intervals.tire_change_km ? `${intervals.tire_change_km.toLocaleString()} km` : "No det."}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Rotación de neumáticos de seguridad
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Source manual link */}
              {intervals.source_url && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-bold italic">
                    ℹ Hemos detectado estos manuales oficiales e intervalos en la web técnica recomendada por el fabricante.
                  </span>
                  <a 
                    href={intervals.source_url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center gap-1.5 font-black text-primary hover:underline uppercase tracking-wide text-[10px]"
                  >
                    Ver Fuente Técnica <ExternalLink className="h-4.5 w-4.5" />
                  </a>
                </div>
              )}

              {/* Upcoming schedule milestones list */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-muted-foreground tracking-widest pl-2">
                  Próximos mantenimientos estimados por IA (Ordenados por fecha y cercanía):
                </h3>

                <div className="space-y-3">
                  {upcoming.map((item: any, idx: number) => {
                    const isUrgent = item.remainingKms <= 2000;
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={idx}
                        className={`p-4 rounded-2xl border flex items-start justify-between gap-4 transition-all hover:bg-white/5 bg-transparent ${
                          isUrgent ? "border-red-500/30" : "border-white/10"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-black text-white text-sm uppercase">
                              {item.title}
                            </span>
                            <Badge className={`text-[8px] font-black uppercase px-2 py-0 border ${getPriorityBadgeColor(item.priority)}`}>
                              Prioridad {item.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                            {item.description}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-black italic ${isUrgent ? "text-red-400" : "text-white"}`}>
                            {~~item.targetKms} km
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            En {~~item.remainingKms <= 0 ? "¡URGENTE!" : `${(~~item.remainingKms).toLocaleString()} km`}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <Button variant="outline" onClick={() => setIntervals(null)} className="rounded-xl font-bold text-xs h-10 border-2">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Volver a calcular
                </Button>
                <Button onClick={onClose} className="rounded-xl font-black text-xs h-10 px-8">
                  De acuerdo, guardar plan
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
