import React, { useState, useEffect } from "react";
import { BookOpen, Upload, Trash2, Loader2, FileText, X, Eye, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/src/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import axios from "axios";

interface VehicleManualsProps {
  vehicleId: string;
  vehicleName: string;
  brand?: string;
  model?: string;
  year?: string | number;
  vin?: string;
  onClose: () => void;
}

interface Manual {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

export function VehicleManuals({ vehicleId, vehicleName, brand, model, year, vin, onClose }: VehicleManualsProps) {
  const { user } = useAuth();
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [suggested, setSuggested] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchManuals();
  }, [vehicleId]);

  const fetchManuals = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/vehicle/${vehicleId}/manuals`, {
        params: {
          brand: brand || "",
          model: model || "",
          year: year || "",
          vin: vin || ""
        }
      });
      if (Array.isArray(res.data)) {
        setManuals(res.data);
        setSuggested(null);
      } else if (res.data) {
        setManuals(res.data.manuals || []);
        setSuggested(res.data.suggestedManual || null);
      }
    } catch (error) {
      console.error("Error loading manuals:", error);
      toast.error("No se pudieron cargar los manuales del vehículo");
    } finally {
      setLoading(false);
    }
  };

  const processFile = (selectedFile: File) => {
    // Check size limit (50MB as requested)
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error("El archivo supera el límite permitido de 50MB.");
      return;
    }

    // Check file type
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(selectedFile.type)) {
      toast.error("Formato no soportado. Sube un manual en PDF, JPG o PNG.");
      return;
    }

    setFile(selectedFile);
    if (!title) {
      // Auto fill title with file name without extension
      const cleanName = selectedFile.name.replace(/\.[^/.]+$/, "");
      setTitle(cleanName);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Por favor selecciona un archivo primero");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("vehicle_id", vehicleId);
    formData.append("title", title || file.name);
    formData.append("description", description);
    formData.append("manual", file);
    formData.append("userId", user?.uid || "");

    try {
      const res = await axios.post("/api/upload-manual", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.status === 201) {
        toast.success("¡Manual subido con éxito!");
        setTitle("");
        setDescription("");
        setFile(null);
        // Clear file input
        const fileInput = document.getElementById("manual-file-upload") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        
        fetchManuals();
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.response?.data?.error || "Error al subir el archivo.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (manualId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este manual?")) return;

    try {
      await axios.delete(`/api/manual/${manualId}`);
      toast.success("Manual eliminado correctamente.");
      fetchManuals();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Error al eliminar el manual.");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/20 bg-card/60 bg-gradient-to-b from-card to-card/90 shadow-2xl p-6 md:p-8 space-y-6 custom-scrollbar"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl border hover:bg-muted/50 transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full">
            📚 Gestión de Manuales
          </span>
          <h2 className="text-2xl font-black font-heading tracking-tight mt-3 uppercase italic">
            Manuales de {vehicleName}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Sube y almacena los manuales del fabricante, guías de usuario o fichas de mantenimiento en PDF, JPG o PNG.
          </p>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleUpload} className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
          <h3 className="text-xs font-black uppercase text-muted-foreground tracking-wider mb-2">
            Subir Nuevo Manual (PDF, PNG, JPG)
          </h3>
          
          {/* Drag & Drop File Zone */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById("manual-file-upload")?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              isDragging 
                ? "border-primary bg-primary/10 scale-[1.01]" 
                : file 
                  ? "border-[#54FFB5]/40 bg-[#54FFB5]/5 hover:bg-[#54FFB5]/10" 
                  : "border-white/10 hover:border-primary/40 hover:bg-white/5"
            }`}
          >
            <input 
              id="manual-file-upload"
              type="file" 
              accept="image/jpeg,image/png,application/pdf"
              className="hidden" 
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className={`p-2.5 rounded-full ${file ? "bg-[#54FFB5]/20 text-[#54FFB5]" : "bg-primary/10 text-primary"} transition-all`}>
                <Upload className={`h-5 w-5 ${isDragging ? "animate-bounce" : ""}`} />
              </div>
              <div>
                {file ? (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-[#54FFB5] truncate max-w-md mx-auto">
                      ✓ {file.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Tamaño: {formatBytes(file.size)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-white">
                    Arrastra y suelta tu manual aquí, o <span className="text-primary hover:underline font-extrabold pb-0.5">haz clic para buscar</span>
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  Formatos PDF, JPG, PNG de hasta 50MB
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Título del documento</label>
              <Input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Guía del Propietario"
                className="rounded-xl border-white/10"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Detalles u observaciones</label>
              <Input 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Fusibles, presión neumáticos"
                className="rounded-xl border-white/10"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button 
              type="submit" 
              disabled={uploading || !file} 
              className="w-full md:w-auto min-w-40 h-11 font-bold rounded-xl"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Guardar en Garaje
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Suggested Official Manual */}
        {suggested && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider">
                  📖 Manual Oficial Sugerido
                </h4>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 uppercase tracking-widest shrink-0">
                Fábrica
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-black text-white truncate uppercase tracking-tight">
                  {suggested.title}
                </p>
                <p className="text-xs text-amber-200/80 mt-1">
                  {suggested.description}
                </p>
              </div>
              <a 
                href={suggested.file_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-xs font-black uppercase text-black transition-all"
              >
                Abrir <ArrowRight className="h-4 w-4 text-black" />
              </a>
            </div>

            {/* If VIN decode succeeded, draw a beautiful compact grid representing vehicle dimensions */}
            {suggested.decodedVinData && (
              <div className="pt-2.5 border-t border-amber-500/10 grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px]">
                {suggested.decodedVinData.make && (
                  <div className="bg-amber-500/5 px-2 py-1.5 rounded-lg border border-amber-500/5">
                    <span className="text-amber-500/60 block font-bold uppercase tracking-wider">Marca</span>
                    <span className="text-amber-100 font-extrabold uppercase">{suggested.decodedVinData.make}</span>
                  </div>
                )}
                {suggested.decodedVinData.model && (
                  <div className="bg-amber-500/5 px-2 py-1.5 rounded-lg border border-amber-500/5">
                    <span className="text-amber-500/60 block font-bold uppercase tracking-wider">Modelo</span>
                    <span className="text-amber-100 font-extrabold uppercase">{suggested.decodedVinData.model}</span>
                  </div>
                )}
                {suggested.decodedVinData.year && (
                  <div className="bg-amber-500/5 px-2 py-1.5 rounded-lg border border-amber-500/5">
                    <span className="text-amber-500/60 block font-bold uppercase tracking-wider">Año de Fabr.</span>
                    <span className="text-amber-100 font-extrabold">{suggested.decodedVinData.year}</span>
                  </div>
                )}
                {suggested.decodedVinData.bodyClass && (
                  <div className="bg-amber-500/5 px-2 py-1.5 rounded-lg border border-amber-500/5 col-span-2 md:col-span-1">
                    <span className="text-amber-500/60 block font-bold uppercase tracking-wider">Chasis</span>
                    <span className="text-amber-100 font-extrabold truncate block">{suggested.decodedVinData.bodyClass}</span>
                  </div>
                )}
                {suggested.decodedVinData.engineCylinders && (
                  <div className="bg-amber-500/5 px-2 py-1.5 rounded-lg border border-amber-500/5">
                    <span className="text-amber-500/60 block font-bold uppercase tracking-wider">Cilindros</span>
                    <span className="text-amber-100 font-extrabold">{suggested.decodedVinData.engineCylinders} Cil.</span>
                  </div>
                )}
                {suggested.decodedVinData.driveType && (
                  <div className="bg-amber-500/5 px-2 py-1.5 rounded-lg border border-amber-500/5">
                    <span className="text-amber-500/60 block font-bold uppercase tracking-wider">Tracción</span>
                    <span className="text-amber-100 font-extrabold truncate block">{suggested.decodedVinData.driveType}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* List of Manuals */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase text-muted-foreground tracking-wider">
            Documentos Guardados ({manuals.length})
          </h3>

          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : manuals.length === 0 ? (
            <div className="text-center p-8 rounded-2xl border-2 border-dashed border-white/10">
              <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm font-black text-muted-foreground">No hay manuales cargados</p>
              <p className="text-xs text-muted-foreground/75 mt-1">Sube un archivo para vincularlo a tu vehículo y acceder desde cualquier lugar.</p>
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {manuals.map((manual) => (
                <div 
                  key={manual.id}
                  className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate pr-2 uppercase text-white tracking-tight leading-none mb-1">
                        {manual.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate leading-none">
                        {manual.description ? `${manual.description} • ` : ""}{formatBytes(manual.file_size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 ml-4 shrink-0">
                    <a 
                      href={manual.file_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      title="Abrir de forma segura en una nueva pestaña"
                      className="p-2 rounded-lg border border-white/5 hover:bg-white/5 transition-all text-muted-foreground hover:text-white"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    <button 
                      onClick={() => handleDelete(manual.id)}
                      title="Eliminar del sistema"
                      className="p-2 rounded-lg border border-white/5 hover:bg-destructive/15 transition-all text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-lg h-9 font-bold text-xs uppercase text-muted-foreground">
            Cerrar Ventana
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
