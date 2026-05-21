import React, { useState, useEffect } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { db } from "@/src/lib/firebase";
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { Gauge, ShieldAlert, History, Activity, Calendar, Award, RefreshCw } from "lucide-react";

interface VehicleHealthChartProps {
  vehicle: any;
}

export function VehicleHealthChart({ vehicle }: VehicleHealthChartProps) {
  const { user } = useAuth();
  const [rawRecords, setRawRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Legend visibility states
  const [showKilometers, setShowKilometers] = useState(true);
  const [showLimitLine, setShowLimitLine] = useState(true);

  // Filter States
  const [datePreset, setDatePreset] = useState<string>("all");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const freq = parseInt(vehicle.maintenanceFrequency) || 15000;
  const current = parseInt(vehicle.currentKms) || 0;
  const lastMain = parseInt(vehicle.lastMaintenanceKms) || 0;
  
  // Upcoming milestone calculation
  const nextTarget = lastMain + freq;
  const kmsSinceLast = Math.max(0, current - lastMain);
  const remaining = Math.max(0, nextTarget - current);
  const isOverdue = current >= nextTarget;
  const ratioSpent = Math.min(100, Math.round((kmsSinceLast / freq) * 100));
  const ratioRemaining = 100 - ratioSpent;

  // Sync date preset selections
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    
    if (datePreset === "all") {
      setCustomStart("");
      setCustomEnd("");
    } else if (datePreset === "3months") {
      const past = new Date();
      past.setMonth(past.getMonth() - 3);
      setCustomStart(past.toISOString().split("T")[0]);
      setCustomEnd(todayStr);
    } else if (datePreset === "6months") {
      const past = new Date();
      past.setMonth(past.getMonth() - 6);
      setCustomStart(past.toISOString().split("T")[0]);
      setCustomEnd(todayStr);
    } else if (datePreset === "1year") {
      const past = new Date();
      past.setFullYear(past.getFullYear() - 1);
      setCustomStart(past.toISOString().split("T")[0]);
      setCustomEnd(todayStr);
    }
  }, [datePreset]);

  // Load complete record set (up to 100 latest items for flexible client-side filter)
  useEffect(() => {
    async function fetchHistoricalData() {
      if (!user || !vehicle.id) return;
      try {
        const q = query(
          collection(db, "vehicles", vehicle.id, "maintenance_history"),
          where("userId", "==", user.uid),
          orderBy("date", "asc"),
          limit(100)
        );
        
        const snap = await getDocs(q);
        const records = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setRawRecords(records);
        setLoading(false);
      } catch (err) {
        console.error("Error loading mileage history for chart:", err);
        setRawRecords([]);
        setLoading(false);
      }
    }

    fetchHistoricalData();
  }, [vehicle.id, user]);

  // Apply client-side filters dynamically based on date range selection
  const filteredRecords = rawRecords.filter((rec: any) => {
    if (!rec.date) return true;
    if (customStart && rec.date < customStart) return false;
    if (customEnd && rec.date > customEnd) return false;
    return true;
  });

  // Build points logic based on active filtered records
  const points: any[] = [];
  if (filteredRecords.length === 0) {
    if (!customStart && !customEnd) {
      // Empty simulation of inspection cycle if no history recorded yet
      points.push({
        name: "Último servicio",
        km: lastMain,
        limite: nextTarget,
        shortName: "Últ."
      });
      points.push({
        name: "Estado Actual",
        km: current,
        limite: nextTarget,
        shortName: "Act."
      });
    }
  } else {
    filteredRecords.forEach((rec: any, idx) => {
      points.push({
        name: rec.serviceType || `Mantenimiento #${idx + 1}`,
        date: rec.date,
        km: rec.kilometers || 0,
        limite: (rec.kilometers || 0) + freq,
        shortName: `M#${idx + 1}`
      });
    });

    // Match chronological sorting and verify if current mileage fits into the chronological sequence of filters
    const lastPointKm = points[points.length - 1]?.km || 0;
    const fitsEndDate = !customEnd || "Hoy" <= customEnd || new Date().toISOString().split("T")[0] <= customEnd;
    if (current > lastPointKm && fitsEndDate) {
      points.push({
        name: "Kilometraje Actual",
        date: "Hoy",
        km: current,
        limite: nextTarget,
        shortName: "Act."
      });
    }
  }

  const getStatusMessage = () => {
    if (isOverdue) return "⚠️ MANTENIMIENTO EXPIRADO. PROGRAMA REVISIÓN INMEDIATA.";
    if (ratioSpent > 90) return "🚨 Crítico: Se recomienda cambio de fluidos esta semana.";
    if (ratioSpent > 70) return "⚠️ Atención: Pronto requiere revisión e inspección.";
    return "✅ Salud óptima. No se requieren acciones preventivas actualmente.";
  };

  const getStatusColors = () => {
    if (isOverdue || ratioSpent > 90) return "text-red-400 bg-red-500/10 border-red-500/20";
    if (ratioSpent > 70) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
    return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  };

  const handleResetFilters = () => {
    setDatePreset("all");
    setCustomStart("");
    setCustomEnd("");
  };

  if (loading) {
    return (
      <div className="py-8 flex flex-col items-center justify-center space-y-2">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/20 border-t-primary"></div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Analizando telemetría...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
      {/* Visual Line Chronology Chart Card */}
      <Card className="lg:col-span-2 border border-white/10 bg-white/5 shadow-md flex flex-col justify-between">
        <div>
          <CardHeader className="p-4 pb-2 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xs uppercase font-black text-white tracking-wider flex items-center gap-2">
                <History className="h-4.5 w-4.5 text-primary" /> Historial de Kilometraje y Umbral de Alerta
              </CardTitle>
              <CardDescription className="text-[10px] text-muted-foreground mt-0.5">
                Filtrado por rango y comparado con el límite de mantenimiento
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              {filteredRecords.length !== rawRecords.length && (
                <Badge className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-yellow-500/15 text-yellow-500 border border-yellow-500/30">
                  Filtrado
                </Badge>
              )}
              <Badge className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-primary/20 text-primary border border-primary/30">
                {points.length} puntos
              </Badge>
            </div>
          </CardHeader>

          {/* Elegant Date Filter Bar over the Chart Area */}
          <div className="p-4 py-3 bg-white/[0.02] border-b border-white/5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider mr-2">Intervalo:</span>
              {[
                { id: "all", label: "Histórico" },
                { id: "3months", label: "3 Meses" },
                { id: "6months", label: "6 Meses" },
                { id: "1year", label: "1 Año" },
                { id: "custom", label: "Personalizado" }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDatePreset(p.id)}
                  className={`px-2.5 py-1 rounded-lg text-[9px] uppercase tracking-wider font-extrabold transition-all border ${
                    datePreset === p.id 
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-white/5 hover:bg-white/10 text-muted-foreground border-white/5"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Range Range Inputs */}
            <AnimatePresence mode="popLayout">
              {(datePreset === "custom" || customStart || customEnd) && (
                <motion.div 
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex flex-wrap items-end gap-3 pt-1"
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] uppercase font-black text-muted-foreground tracking-widest">Desde:</label>
                    <input 
                      type="date"
                      value={customStart}
                      onChange={(e) => {
                        setDatePreset("custom");
                        setCustomStart(e.target.value);
                      }}
                      className="bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-primary transition-colors cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] uppercase font-black text-muted-foreground tracking-widest">Hasta:</label>
                    <input 
                      type="date"
                      value={customEnd}
                      onChange={(e) => {
                        setDatePreset("custom");
                        setCustomEnd(e.target.value);
                      }}
                      className="bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-primary transition-colors cursor-pointer"
                    />
                  </div>
                  <button
                    onClick={handleResetFilters}
                    className="flex items-center gap-1 px-3 h-7 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] uppercase tracking-wider font-extrabold text-white transition-colors self-end"
                  >
                    <RefreshCw className="h-3 w-3 text-red-400" />
                    Restablecer
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <CardContent className="p-4 pt-6">
            {/* Interactive Legend panel */}
            <div className="flex items-center gap-4 justify-center mb-4 pb-2 border-b border-white/5 select-none">
              <button
                onClick={() => setShowKilometers(!showKilometers)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  showKilometers 
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400 font-extrabold shadow-sm" 
                    : "bg-white/[0.02] border-white/5 text-muted-foreground opacity-60 hover:opacity-100"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${showKilometers ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-neutral-600'}`}></span>
                Kilometraje Real
              </button>
              <button
                onClick={() => setShowLimitLine(!showLimitLine)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  showLimitLine 
                    ? isOverdue
                      ? "bg-red-500/10 border-red-500/30 text-red-400 font-extrabold shadow-sm"
                      : "bg-yellow-500/10 border-yellow-500/30 text-yellow-500 font-extrabold shadow-sm" 
                    : "bg-white/[0.02] border-white/5 text-muted-foreground opacity-60 hover:opacity-100"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${
                  showLimitLine 
                    ? isOverdue ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' 
                    : 'bg-neutral-600'
                }`}></span>
                Umbral / Límite
              </button>
            </div>

            <div className="h-[220px] w-full relative container-recharts-responsive">
              <AnimatePresence mode="wait">
                {points.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-neutral-900/40 rounded-xl border border-dashed border-white/10"
                  >
                    <Calendar className="h-8 w-8 text-neutral-500 mb-2 animate-pulse" />
                    <p className="text-[11px] font-bold text-white uppercase tracking-wider">No hay inspecciones registradas</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 max-w-xs leading-normal">
                      No se detectaron eventos registrados de mantenimiento entre {customStart || "el inicio"} y {customEnd || "hoy"}.
                    </p>
                    <button 
                      onClick={handleResetFilters}
                      className="mt-3 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-lg text-[9px] uppercase tracking-wider font-black transition-colors"
                    >
                      Limpiar rango de fechas
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    className="h-full w-full origin-bottom"
                    initial={{ opacity: 0, scaleY: 0.3, y: 25 }}
                    animate={{ opacity: 1, scaleY: 1, y: 0 }}
                    exit={{ opacity: 0, scaleY: 0.3, y: 25 }}
                    transition={{ 
                      type: "spring", 
                      damping: 18, 
                      stiffness: 90, 
                      mass: 0.8
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%" className="recharts-responsive-container">
                      <AreaChart
                        data={points}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorKm" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                          dataKey="shortName" 
                          stroke="rgba(255,255,255,0.4)" 
                          fontSize={10}
                          tickLine={false}
                        />
                        <YAxis 
                          stroke="rgba(255,255,255,0.4)" 
                          fontSize={10} 
                          tickLine={false}
                          tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(15, 23, 42, 0.95)",
                            borderColor: "rgba(255, 255, 255, 0.15)",
                            borderRadius: "12px",
                            color: "#fff",
                            fontSize: "11px",
                            fontFamily: "monospace"
                          }}
                          formatter={(value: any, name: string) => {
                            if (name === "km") return [`${value.toLocaleString()} km`, "Kilometros"];
                            if (name === "limite") return [`${value.toLocaleString()} km`, "Próxima Revisión"];
                            return [value, name];
                          }}
                          labelFormatter={(index) => {
                            const pData = points[index];
                            return pData ? `${pData.name} ${pData.date ? `(${pData.date})` : ""}` : "";
                          }}
                        />
                        {showKilometers && (
                          <Area 
                            type="monotone" 
                            dataKey="km" 
                            stroke="#3b82f6" 
                            strokeWidth={2.5}
                            fillOpacity={1} 
                            fill="url(#colorKm)" 
                            name="km"
                          />
                        )}
                        {showLimitLine && (
                          <ReferenceLine 
                            y={nextTarget} 
                            stroke={isOverdue ? "#ef4444" : "#eab308"} 
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{ 
                              value: `Límite (${(nextTarget / 1000).toFixed(0)}k km)`, 
                              position: 'top', 
                              fill: isOverdue ? '#f87171' : '#facc15',
                              fontSize: 9,
                              fontWeight: "bold"
                            }} 
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Modern Donut Gauge */}
      <Card className="border border-white/10 bg-white/5 shadow-md flex flex-col justify-between">
        <CardHeader className="p-4 pb-1 border-b border-white/5">
          <CardTitle className="text-xs uppercase font-black text-white tracking-wider flex items-center gap-2">
            <Gauge className="h-4.5 w-4.5 text-primary" /> Salud del Ciclo Actual
          </CardTitle>
          <CardDescription className="text-[10px] text-muted-foreground">
            Vida útil de lubricantes y filtros
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-4 flex flex-col items-center justify-center flex-1">
          <div className="relative h-[110px] w-full flex items-center justify-center">
            {/* Direct visual ring indication using Tailwind gradients and overlays for high-contrast safety */}
            <div className="relative w-24 h-24 rounded-full flex items-center justify-center bg-neutral-900 border-4 border-white/5 shadow-inner">
              <div className="absolute inset-0 rounded-full border-4 border-transparent" style={{
                borderTopColor: isOverdue ? "#ef4444" : ratioSpent > 90 ? "#ef4444" : ratioSpent > 70 ? "#eab308" : "#22c55e",
                transform: `rotate(${Math.min(360, (ratioSpent / 100) * 360)}deg)`,
                transition: "transform 0.6s ease"
              }}></div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-black italic text-white leading-none">
                  {isOverdue ? "0%" : `${ratioRemaining}%`}
                </span>
                <span className="text-[7px] uppercase tracking-widest text-muted-foreground font-extrabold mt-1">
                  Vida Útil
                </span>
              </div>
            </div>
          </div>

          <div className="w-full space-y-2 mt-4">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-muted-foreground font-bold uppercase tracking-wider">Recorrido:</span>
              <span className="font-mono text-white font-extrabold">{kmsSinceLast.toLocaleString()} km</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-muted-foreground font-bold uppercase tracking-wider">Restante:</span>
              <span className={`font-mono font-extrabold ${remaining <= 1000 ? "text-red-400" : "text-white"}`}>
                {isOverdue ? "¡VENCIDO!" : `${remaining.toLocaleString()} km`}
              </span>
            </div>
            <div className="p-2 border rounded-xl text-[9px] font-bold leading-normal text-center mt-3 uppercase tracking-wide transition-all duration-300 shadow-sm rounded-lg border-white/10 overflow-hidden text-ellipsis whitespace-nowrap block text-white/90 bg-white/5">
              Próxima: <span className="text-primary font-black italic">{~~nextTarget} km</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health status banner footer spanned all columns */}
      <div className={`lg:col-span-3 p-3.5 rounded-2xl border flex items-center gap-3 transition-colors ${getStatusColors()}`}>
        {isOverdue ? (
          <ShieldAlert className="h-5 w-5 animate-bounce shrink-0" />
        ) : (
          <Activity className="h-5 w-5 animate-pulse shrink-0" />
        )}
        <div className="text-[10px] font-black uppercase tracking-wider leading-relaxed">
          {getStatusMessage()}
        </div>
      </div>
    </div>
  );
}
