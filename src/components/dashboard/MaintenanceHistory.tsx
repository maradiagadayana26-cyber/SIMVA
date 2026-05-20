import React, { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, where } from "firebase/firestore";
import { useAuth } from "@/src/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Wrench, Plus, Trash2, Calendar, Gauge, History } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface MaintenanceHistoryProps {
  vehicleId: string;
}

export function MaintenanceHistory({ vehicleId }: MaintenanceHistoryProps) {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    serviceType: "",
    kilometers: "",
    notes: ""
  });

  useEffect(() => {
    if (!vehicleId) return;

    const q = query(
      collection(db, "vehicles", vehicleId, "maintenance_history"),
      where("userId", "==", user?.uid),
      orderBy("date", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "maintenance_history");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [vehicleId]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, "vehicles", vehicleId, "maintenance_history"), {
        userId: user.uid,
        vehicleId,
        date: formData.date,
        serviceType: formData.serviceType,
        kilometers: parseInt(formData.kilometers),
        notes: formData.notes,
        createdAt: serverTimestamp()
      });

      toast.success("Mantenimiento registrado");
      setShowAddForm(false);
      setFormData({
        date: new Date().toISOString().split("T")[0],
        serviceType: "",
        kilometers: "",
        notes: ""
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "maintenance_history");
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, "vehicles", vehicleId, "maintenance_history", id));
      toast.success("Registro eliminado");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "maintenance_history");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-2xl font-black italic uppercase tracking-tighter flex items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          Historial de Mantenimiento
        </h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowAddForm(!showAddForm)}
          className="rounded-xl border-2 border-primary/20 bg-primary/5 font-bold hover:bg-primary/10"
        >
          {showAddForm ? "Cancelar" : <><Plus className="mr-2 h-4 w-4" /> Registrar Servicio</>}
        </Button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border border-white/30 bg-transparent backdrop-blur-md shadow-lg">
              <CardHeader className="pb-4 bg-white/5 border-b border-white/10">
                <CardTitle className="text-sm font-black uppercase tracking-widest italic">Nuevo Registro</CardTitle>
                <CardDescription>Añade los detalles del servicio realizado.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddRecord} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest italic">Fecha</Label>
                    <Input 
                      type="date" 
                      required 
                      value={formData.date} 
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="h-10 border-2" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest italic">Kilómetros</Label>
                    <Input 
                      type="number" 
                      required 
                      placeholder="Km actuales" 
                      value={formData.kilometers} 
                      onChange={(e) => setFormData({...formData, kilometers: e.target.value})}
                      className="h-10 border-2" 
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest italic">Tipo de Servicio</Label>
                    <Input 
                      required 
                      placeholder="Ej. Cambio de Aceite, Filtros, ITV..." 
                      value={formData.serviceType} 
                      onChange={(e) => setFormData({...formData, serviceType: e.target.value})}
                      className="h-10 border-2" 
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest italic">Notas (Opcional)</Label>
                    <Input 
                      placeholder="Detalles adicionales..." 
                      value={formData.notes} 
                      onChange={(e) => setFormData({...formData, notes: e.target.value})}
                      className="h-10 border-2" 
                    />
                  </div>
                  <div className="md:col-span-2 pt-2">
                    <Button type="submit" className="w-full h-12 font-bold rounded-xl shadow-lg bg-primary text-primary-foreground">
                      Guardar Registro
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {loading ? (
          <div className="py-8 text-center text-muted-foreground animate-pulse">Cargando historial...</div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center bg-muted/30 rounded-3xl border-2 border-dashed border-white/5">
            <Wrench className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="font-bold text-muted-foreground italic">No hay servicios registrados aún</p>
            <p className="text-xs text-muted-foreground/60">Registra tu primer mantenimiento para llevar un control profesional.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {records.map((record) => (
              <motion.div
                key={record.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group p-4 bg-transparent backdrop-blur-sm rounded-2xl border border-white/20 hover:border-primary/50 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="p-1 px-2 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest italic">
                        {record.serviceType}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground text-xs font-bold">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-primary" />
                        {format(new Date(record.date), "d MMM yyyy", { locale: es })}
                      </div>
                      <div className="flex items-center gap-1">
                        <Gauge className="h-3 w-3 text-primary" />
                        {record.kilometers.toLocaleString()} km
                      </div>
                    </div>
                    {record.notes && (
                      <p className="mt-2 text-xs text-muted-foreground italic truncate">{record.notes}</p>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDeleteRecord(record.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 rounded-xl"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
