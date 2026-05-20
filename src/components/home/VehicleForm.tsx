import React, { useState } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Car, ChevronLeft, Save, Upload, ShieldCheck, Camera, FileText } from "lucide-react";
import axios from "axios";
import { rescheduleVehicleNotificationsClient } from "@/src/lib/notification-scheduler-client";

import { LegalDocType } from "../legal/Documents";
import { MaintenanceHistory } from "../dashboard/MaintenanceHistory";

interface VehicleFormProps {
  vehicle?: any;
  onSuccess: () => void;
  onCancel: () => void;
  onShowLegal?: (type: LegalDocType) => void;
}

const BRANDS = ["Toyota", "Volkswagen", "BMW", "Audi", "Mercedes-Benz", "Ford", "Hyundai", "Renault", "Peugeot", "Seat", "Kia", "Fiat"];
const FUEL_TYPES = ["Gasolina", "Diésel", "Híbrido", "Eléctrico", "GLP"];
const FREQUENCIES = [
  { label: "10.000 km", value: "10000" },
  { label: "15.000 km (Recomendado)", value: "15000" },
  { label: "20.000 km", value: "20000" },
  { label: "30.000 km", value: "30000" },
];

export function VehicleForm({ vehicle, onSuccess, onCancel, onShowLegal }: VehicleFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    brand: vehicle?.brand || "",
    model: vehicle?.model || "",
    year: vehicle?.year?.toString() || new Date().getFullYear().toString(),
    fuelType: vehicle?.fuelType || "",
    currentKms: vehicle?.currentKms?.toString() || "",
    maintenanceFrequency: vehicle?.maintenanceFrequency || "15000",
    lastMaintenanceKms: vehicle?.lastMaintenanceKms?.toString() || "",
    plate: vehicle?.plate || "",
    itvDueDate: vehicle?.itvDueDate || "",
    gdprAccepted: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.gdprAccepted) {
      toast.error("Debes aceptar el tratamiento de datos");
      return;
    }

    setLoading(true);
    try {
      // Record Consents
      if (!vehicle?.id) {
        await addDoc(collection(db, "user_consents"), {
          userId: user?.uid,
          consentType: "data_treatment",
          accepted: true,
          version: "v1.1",
          userAgent: navigator.userAgent,
          acceptedAt: serverTimestamp()
        });
      }

      const data = {
        userId: user?.uid,
        brand: formData.brand,
        model: formData.model,
        year: parseInt(formData.year),
        fuelType: formData.fuelType,
        currentKms: parseInt(formData.currentKms),
        maintenanceFrequency: formData.maintenanceFrequency,
        lastMaintenanceKms: parseInt(formData.lastMaintenanceKms || "0"),
        plate: formData.plate,
        itvDueDate: formData.itvDueDate || null,
        updatedAt: serverTimestamp(),
      };

      let vehicleId = vehicle?.id;

      if (vehicle?.id) {
        await updateDoc(doc(db, "vehicles", vehicle.id), data);
        toast.success("Vehículo actualizado correctamente");
      } else {
        const docRef = await addDoc(collection(db, "vehicles"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        vehicleId = docRef.id;
        toast.success("¡Vehículo registrado! Simva ya lo está monitorizando.");
      }

      // Reschedule notifications via Client-side scheduler & Server REST wrapper
      try {
        if (user?.uid && vehicleId) {
          await rescheduleVehicleNotificationsClient(user.uid, vehicleId, data);
        }
      } catch (clientErr) {
        console.error("Error rescheduling notifications client-side:", clientErr);
      }

      try {
        await axios.post("/api/reschedule-vehicle-notifications", {
          userId: user?.uid,
          vehicleId,
          vehicleData: data
        });
      } catch (err) {
        console.debug("Optional reschedule API called.");
      }

      onSuccess();
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, "vehicles");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto pb-32">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel} className="rounded-full">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-3xl font-black font-heading tracking-tight">
            {vehicle ? "Actualizar Vehículo" : "Registrar Vehículo"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="border border-white/30 bg-transparent backdrop-blur-lg shadow-xl">
          <CardHeader className="bg-white/5 pb-4 border-b border-white/10">
            <CardTitle className="font-heading">Datos del Coche</CardTitle>
            <CardDescription>Completa la información técnica de tu vehículo.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Marca</Label>
              <Select value={formData.brand} onValueChange={(val) => setFormData({...formData, brand: val})}>
                <SelectTrigger className="h-12 border-2 focus:ring-primary/20">
                  <SelectValue placeholder="Selecciona una marca" />
                </SelectTrigger>
                <SelectContent>
                  {BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input 
                className="h-12 border-2" 
                placeholder="Ej. Golf, Serie 3..." 
                value={formData.model} 
                onChange={(e) => setFormData({...formData, model: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>Año de Fabricación</Label>
              <Input 
                type="number" 
                className="h-12 border-2" 
                value={formData.year} 
                onChange={(e) => setFormData({...formData, year: e.target.value})} 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>Combustible</Label>
              <Select value={formData.fuelType} onValueChange={(val) => setFormData({...formData, fuelType: val})}>
                <SelectTrigger className="h-12 border-2">
                  <SelectValue placeholder="Tipo de combustible" />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input 
                className="h-12 border-2 font-bold uppercase" 
                placeholder="1234 ABC" 
                value={formData.plate} 
                onChange={(e) => setFormData({...formData, plate: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Kilómetros Actuales</Label>
              <Input 
                type="number" 
                className="h-12 border-2" 
                placeholder="0" 
                value={formData.currentKms} 
                onChange={(e) => setFormData({...formData, currentKms: e.target.value})} 
                required 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/30 bg-transparent backdrop-blur-lg shadow-xl">
          <CardHeader className="bg-white/5 pb-4 border-b border-white/10">
            <CardTitle className="font-heading">Plan de Mantenimiento</CardTitle>
            <CardDescription>Configura cuándo quieres que Simva te avise.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Frecuencia de Revisión</Label>
              <Select value={formData.maintenanceFrequency} onValueChange={(val) => setFormData({...formData, maintenanceFrequency: val})}>
                <SelectTrigger className="h-12 border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Km en la última revisión</Label>
              <Input 
                type="number" 
                className="h-12 border-2" 
                placeholder="0" 
                value={formData.lastMaintenanceKms} 
                onChange={(e) => setFormData({...formData, lastMaintenanceKms: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Próximo Vencimiento de ITV</Label>
              <Input 
                type="date" 
                className="h-12 border-2 text-foreground" 
                value={formData.itvDueDate} 
                onChange={(e) => setFormData({...formData, itvDueDate: e.target.value})} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/30 bg-transparent backdrop-blur-lg shadow-xl">
          <CardHeader className="bg-white/5 pb-4 border-b border-white/10">
            <CardTitle className="font-heading flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Ficha Técnica del Vehículo
            </CardTitle>
            <CardDescription>
              Sube una foto o PDF de la ficha técnica, tarjeta ITV o documento similar. 
              Máximo 5MB. Formatos: JPG, PNG, HEIC, PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div 
              onClick={() => document.getElementById('tech-sheet-input')?.click()}
              className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-3xl bg-muted/30 gap-4 hover:bg-muted/50 transition-all cursor-pointer group relative overflow-hidden"
            >
              {vehicle?.techSheetImg && (
                <img src={vehicle.techSheetImg} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none" />
              )}
              <Input 
                id="tech-sheet-input"
                type="file" 
                className="hidden" 
                accept="image/jpeg,image/png,image/heic,application/pdf"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  if (file.size > 5 * 1024 * 1024) {
                    toast.error("El archivo supera el límite de 5MB");
                    return;
                  }
                  
                  const formData = new FormData();
                  formData.append('file', file);
                  if (vehicle?.id) formData.append('vehicleId', vehicle.id);
                  formData.append('userId', user?.uid || '');

                  setLoading(true);
                  try {
                    const res = await axios.post("/api/vehicles/upload-technical-sheet", formData, {
                      headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    if (res.data.success) {
                      const uploadedUrl = res.data.url;
                      if (vehicle?.id && uploadedUrl) {
                        try {
                          await updateDoc(doc(db, "vehicles", vehicle.id), {
                            techSheetImg: uploadedUrl,
                            updatedAt: serverTimestamp()
                          });
                        } catch (dbErr) {
                          console.error("Error updating tech sheet client-side:", dbErr);
                        }
                      }
                      toast.success("Ficha técnica subida correctamente.");
                    } else {
                      toast.error(res.data.message || "Error al subir");
                    }
                  } catch (err: any) {
                    toast.error(err.response?.data?.message || "Error al conectar con el servidor");
                  } finally {
                    setLoading(false);
                  }
                }}
              />
              <div className="h-16 w-16 rounded-2xl bg-background flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform relative z-10">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center relative z-10">
                <p className="text-lg font-black font-heading tracking-tight">
                  {vehicle?.techSheetImg ? "Cambiar ficha técnica" : "➕ Añadir ficha técnica"}
                </p>
                <p className="text-xs text-muted-foreground italic">Pulsa para tomar foto o elegir archivo</p>
              </div>
            </div>
            <p className="mt-4 text-[10px] text-muted-foreground italic text-center px-4">
              "Las imágenes se almacenan de forma segura y solo se usan para fines de mantenimiento. 
              Puedes eliminarlas en cualquier momento."
            </p>
          </CardContent>
        </Card>

        {vehicle?.id && (
          <MaintenanceHistory vehicleId={vehicle.id} />
        )}

        <div className="space-y-4 px-2">
            <div className="flex items-start space-x-3">
              <Checkbox 
                id="gdpr" 
                checked={formData.gdprAccepted} 
                onCheckedChange={(val) => setFormData({...formData, gdprAccepted: !!val})} 
              />
              <div className="grid gap-1.5 leading-none">
                <label htmlFor="gdpr" className="text-sm font-medium leading-none cursor-pointer">
                  Acepto el <button type="button" onClick={() => onShowLegal?.('privacy')} className="text-primary hover:underline font-bold">tratamiento de mis datos personales</button> conforme a la Política de Privacidad de SIMVA.
                </label>
              </div>
            </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button type="button" variant="ghost" className="h-14 flex-1 text-lg" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" className="h-14 flex-[2] text-lg font-bold bg-gradient-to-r from-[#2AC1FF] to-[#54FFB5] text-black shadow-xl shadow-[#2AC1FF]/20 border-none" disabled={loading}>
            <Save className="mr-2 h-5 w-5" />
            {loading ? "Guardando..." : "Guardar Vehículo"}
          </Button>
        </div>
      </form>
    </div>
  );
}
