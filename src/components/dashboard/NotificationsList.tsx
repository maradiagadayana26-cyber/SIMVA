import { useState, useEffect } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, Clock, CheckCircle2, Wrench, ShieldCheck, AlertTriangle, Sparkles, BellRing, Droplet } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import OneSignal from "react-onesignal";
import { isOneSignalReady } from "@/src/lib/onesignal";
import axios from "axios";
import { toast } from "sonner";
import { SimvaLogo } from "../icons/SimvaLogo";

export function NotificationsList() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [osPermission, setOsPermission] = useState<string>("default");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [simulating, setSimulating] = useState(false);

  // Load In-App Notifications
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/notifications`);
    });

    return unsubscribe;
  }, [user]);

  // Load User Vehicles for context extraction
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "vehicles"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(list);
      if (list.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(list[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "vehicles");
    });

    return unsubscribe;
  }, [user]);

  // Track OneSignal Permissions
  useEffect(() => {
    const checkPermission = async () => {
      if (typeof window !== "undefined" && typeof OneSignal !== "undefined" && (OneSignal as any).Notifications) {
        setOsPermission((OneSignal as any).Notifications.permission || "default");
      }
    };
    checkPermission();
    const interval = setInterval(checkPermission, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleRequestPermission = async () => {
    if (typeof window !== "undefined" && typeof OneSignal !== "undefined" && (OneSignal as any).Notifications) {
      try {
        await (OneSignal as any).Notifications.requestPermission();
        if ((OneSignal as any).Notifications.permission) {
          setOsPermission((OneSignal as any).Notifications.permission);
        }
        toast.success("Solicitud enviada. Recuerda aceptar los permisos si aparece el prompt del navegador.");
      } catch (err: any) {
        console.error("OneSignal request permission error:", err);
        toast.error("Error al procesar la solicitud de permisos.");
      }
    } else {
      toast.error("OneSignal no listo. Verifica que esté configurada la variable VITE_ONESIGNAL_APP_ID.");
    }
  };

  const triggerSimulation = async (type: 'maintenance' | 'itv') => {
    if (!user) return;
    setSimulating(true);

    let vehicleName = "Vehículo de Prueba";
    let detail = "";
    
    const activeVehicle = vehicles.find(v => v.id === selectedVehicleId);
    if (activeVehicle) {
      vehicleName = `${activeVehicle.brand} ${activeVehicle.model}`;
      detail = type === 'maintenance'
        ? `Requiere su mantenimiento preventivo a los ${activeVehicle.maintenanceFrequency || '15000'} km (Km actuales: ${activeVehicle.currentKms || 0})`
        : `Tienes tu cita de ITV programada próximamente (Fecha de vencimiento: ${activeVehicle.itvDueDate || 'Pendiente de registrar'})`;
    } else {
      vehicleName = "León Demo Especial";
      detail = type === 'maintenance'
        ? "Mantenimiento crítico necesario por cumplimiento de los 15.000 kilómetros"
        : "Fecha límite de examen técnico ITV próxima (Vencimiento: 30 de Junio)";
    }

    try {
      const title = type === 'maintenance' 
        ? `🔧 Alerta de Mantenimiento: ${vehicleName}` 
        : `🚗 Cita e ITV Próxima: ${vehicleName}`;
      
      const body = type === 'maintenance'
        ? `Hola, es momento de que tu ${vehicleName} pase por boxes para su mantenimiento periódico.`
        : `Recordatorio: La inspección ITV de tu ${vehicleName} está programada. Evita multas graves.`;

      // 1. In-App Notification insertion to keep visual log
      await addDoc(collection(db, "users", user.uid, "notifications"), {
        userId: user.uid,
        title,
        message: `${detail}. Alerta despachada vía push y correo OneSignal de inmediato.`,
        type,
        relatedVehicleId: selectedVehicleId || "demo-vehicle",
        isRead: false,
        createdAt: serverTimestamp()
      });

      // 2. HTTP POST simulation to express API
      const response = await axios.post("/api/send-push", {
        userId: user.uid,
        title,
        body,
        type: type,
        userEmail: user.email,
        userName: user.displayName || user.email?.split('@')[0] || 'Usuario'
      });

      if (response.data?.success) {
        toast.success(`Push OneSignal & Email (${type.toUpperCase()}) emitido con éxito`);
      } else {
        toast.info(`¡Alerta generada en bandeja! (OneSignal requiere permisos de navegador concedidos)`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al emitir simulación en el servidor.");
    } finally {
      setSimulating(false);
    }
  };

  const handleMarkAsRead = async (id: string, currentlyRead: boolean) => {
    if (currentlyRead || !user) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "notifications", id), { isRead: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/notifications/${id}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    const unread = notifications.filter(n => !n.isRead);
    for (const notif of unread) {
      await handleMarkAsRead(notif.id, false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="p-4 sm:p-8 space-y-8 pb-32 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black font-heading tracking-tighter uppercase italic">Avisos 🦁</h1>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
            {unreadCount > 0 ? `Tienes ${unreadCount} alertas sin leer` : "Sistemas en orden nominal"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={handleMarkAllAsRead}
            className="text-[10px] font-black uppercase tracking-widest text-[#2AC1FF] hover:text-[#54FFB5] transition-colors py-2 px-4 rounded-full border border-primary/20 bg-primary/5"
          >
            Autorizar leídos
          </button>
        )}
      </div>

      {/* Feed list */}
      <div className="grid gap-4 text-left">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 mt-4 text-center">
            <div className="h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-muted-foreground animate-pulse" />
            </div>
            <h2 className="text-xl font-black font-heading uppercase italic tracking-tighter">Sin avisos pendientes</h2>
            <p className="text-muted-foreground mt-1 max-w-sm text-xs">No hay alertas de mantenimiento o ITV pendientes. ¡Tu vehículo está al día!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {notifications.map((notif, idx) => (
              <motion.div
                key={notif.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => handleMarkAsRead(notif.id, notif.isRead)}
              >
                <Card className={cn(
                  "border-2 transition-all cursor-pointer overflow-hidden group relative rounded-[2rem] backdrop-blur-md",
                  notif.isRead 
                    ? "bg-white/5 border-white/10 opacity-60 grayscale-[0.5]" 
                    : "bg-white/10 border-primary/20 hover:border-primary/50 shadow-2xl shadow-black/20"
                )}>
                  <div className="flex">
                    <div className={cn(
                      "w-2 transition-all",
                      notif.isRead ? "bg-muted" : "bg-primary animate-pulse"
                    )} />
                    <div className="flex-1">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-10 w-10 rounded-2xl flex items-center justify-center",
                              notif.isRead ? "bg-muted/20" : "bg-primary/20"
                            )}>
                              {notif.type === 'maintenance' ? <Wrench className="h-5 w-5" /> : 
                               notif.type === 'itv' ? <AlertTriangle className="h-5 w-5 text-blue-400" /> :
                               notif.type === 'oil_change' ? <Droplet className="h-5 w-5 text-amber-500 animate-pulse" /> :
                               notif.type === 'welcome' ? <SimvaLogo className="h-5 w-5" /> :
                               <Bell className="h-5 w-5" />}
                            </div>
                            <div>
                              <CardTitle className={cn(
                                "text-xl font-heading uppercase italic tracking-tighter leading-none",
                                notif.isRead ? "text-muted-foreground" : "text-foreground"
                              )}>
                                {notif.title}
                              </CardTitle>
                              <div className="flex items-center gap-1.5 mt-1.5 text-[9px] uppercase font-bold text-muted-foreground tracking-widest">
                                <Clock className="h-3 w-3" />
                                {notif.createdAt?.toDate ? format(notif.createdAt.toDate(), "d MMM, HH:mm", { locale: es }) : "Reciente"}
                                {!notif.isRead && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded-md bg-primary text-black font-black">NUEVO</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {notif.isRead && <CheckCircle2 className="h-5 w-5 text-green-500/50" />}
                        </div>
                      </CardHeader>
                      <CardContent className="pb-6 pt-0">
                        <p className={cn(
                          "text-sm font-medium leading-relaxed-paragraph text-balance",
                          notif.isRead ? "text-muted-foreground/50" : "text-muted-foreground"
                        )}>
                          {notif.message}
                        </p>
                      </CardContent>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
