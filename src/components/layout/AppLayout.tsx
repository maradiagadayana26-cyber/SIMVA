import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Dashboard } from "../dashboard/Dashboard";
import { VehicleForm } from "../home/VehicleForm";
import { NotificationsList } from "../dashboard/NotificationsList";
import { WorkshopSearch } from "../workshop/WorkshopSearch";
import { GmailPortal } from "../gmail/GmailPortal";
import { SimvaLogo } from "../icons/SimvaLogo";
import { CustomBackground } from "./CustomBackground";
import { useAuth } from "@/src/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, LogOut, AlertTriangle, Bell, Wrench } from "lucide-react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AppDownloadSection } from "../ui/AppDownloadSection";
import { LegalDocuments, LegalDocType } from "../legal/Documents";

export function AppLayout() {
  const { profile, updateProfile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLegalDoc, setShowLegalDoc] = useState<LegalDocType | null>(null);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Sesión cerrada correctamente");
    } catch (error) {
      toast.error("Error al cerrar sesión");
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard onEdit={(v) => { setEditingVehicle(v); setActiveTab("register"); }} onShowWorkshops={() => setActiveTab("workshops")} />;
      case "register":
        return (
          <VehicleForm 
            vehicle={editingVehicle} 
            onSuccess={() => { setActiveTab("dashboard"); setEditingVehicle(null); }}
            onCancel={() => { setActiveTab("dashboard"); setEditingVehicle(null); }}
            onShowLegal={setShowLegalDoc}
          />
        );
      case "notifications":
        return <NotificationsList />;
      case "workshops":
        return <WorkshopSearch />;
      case "gmail":
        return <GmailPortal />;
      case "settings":
        return (
          <div className="p-8 max-w-2xl mx-auto space-y-8">
            <h1 className="text-3xl font-black font-heading tracking-tight text-foreground">Ajustes de Simva</h1>
            
            <div className="space-y-6">
               <div className="p-6 rounded-3xl border-2 bg-card shadow-xl shadow-primary/5">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <SimvaLogo className="h-5 w-5" />
                    Apariencia
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                     {[
                       { id: 'light', label: 'Claro' },
                       { id: 'dark', label: 'Oscuro' },
                       { id: 'system', label: 'Sistema' }
                     ].map((t) => (
                       <button 
                         key={t.id}
                         onClick={() => updateProfile({ app_theme: t.id as any })}
                         className={cn(
                           "p-4 rounded-2xl border-2 transition-all font-bold text-sm",
                           profile?.app_theme === t.id 
                             ? "border-primary bg-primary/5 text-primary shadow-lg shadow-primary/10" 
                             : "border-muted hover:border-primary/50"
                         )}
                       >
                         {t.label}
                       </button>
                     ))}
                  </div>
               </div>

               <div className="p-6 rounded-3xl border-2 bg-card shadow-xl shadow-primary/5">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    Notificaciones
                  </h3>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
                       <div className="space-y-0.5">
                         <p className="text-sm font-bold">Alertas de Mantenimiento</p>
                         <p className="text-xs text-muted-foreground italic">Recibe un email cuando tu vehículo necesite revisión</p>
                       </div>
                       <Switch 
                         checked={profile?.email_maintenance_enabled ?? true} 
                         onCheckedChange={async (checked) => {
                           await updateProfile({ email_maintenance_enabled: checked });
                           const { updateEmailPreferences } = await import("@/src/services/notificationService");
                           await updateEmailPreferences(checked);
                         }}
                       />
                     </div>
                     <p className="text-[10px] text-muted-foreground px-2 text-left">
                       * Los correos de bienvenida y seguridad son obligatorios por ley y no pueden desactivarse.
                     </p>
                  </div>
               </div>

               <div className="p-6 rounded-3xl border-2 bg-card shadow-xl shadow-primary/5">
                  <h3 className="font-bold mb-4">Privacidad y Legal</h3>
                  <div className="space-y-3">
                    {[
                      { label: "Política de Privacidad", type: "privacy" as LegalDocType },
                      { label: "Términos y Condiciones", type: "terms" as LegalDocType },
                      { label: "Política de Cookies", type: "cookies" as LegalDocType },
                      { label: "Aviso Legal", type: "notice" as LegalDocType }
                    ].map((item) => (
                      <button 
                        key={item.label} 
                        onClick={() => setShowLegalDoc(item.type)}
                        className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-muted transition-colors text-sm font-medium"
                      >
                        {item.label}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                    
                    <div className="pt-4 grid grid-cols-2 gap-3">
                       <Button variant="outline" className="text-xs font-bold h-10 rounded-xl" onClick={() => setShowLogoutConfirm(true)}>
                         <LogOut className="h-4 w-4 mr-2" />
                         Cerrar Sesión
                       </Button>
                       <Button variant="outline" className="text-xs font-bold h-10 rounded-xl">
                         Exportar Datos
                       </Button>
                    </div>
                    <div className="pt-2">
                       <Button variant="outline" className="w-full text-xs font-bold h-10 rounded-xl" onClick={() => toast.success("Consentimientos revocados")}>
                         Retirar Consentimiento
                       </Button>
                    </div>
                  </div>
               </div>

               <div className="p-6 rounded-3xl border-2 bg-red-500/5 border-red-500/20">
                  <h3 className="font-bold text-red-500 mb-2">Zona de Peligro</h3>
                  <p className="text-xs text-muted-foreground mb-4">Estas acciones son irreversibles.</p>
                  <Button variant="destructive" className="w-full rounded-2xl h-12 font-bold">
                    Eliminar mi cuenta y todos los datos
                  </Button>
               </div>

               <AppDownloadSection />
            </div>
          </div>
        );
      default:
        return <div>Próximamente</div>;
    }
  };

  return (
    <CustomBackground>
      <div className="flex h-screen">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="flex-1 flex flex-col h-screen overflow-y-auto pb-20 lg:pb-0">
          <main className="flex-1">
            {renderContent()}
          </main>
        </div>
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
          <AlertDialogContent className="rounded-3xl border-2">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                ¿Cerrar sesión?
              </AlertDialogTitle>
              <AlertDialogDescription>
                ¿Seguro que quieres cerrar sesión? Tendrás que iniciar sesión nuevamente para acceder a tus datos del garaje.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel variant="outline" size="default" className="rounded-2xl">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogout} className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold">
                Cerrar Sesión
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Legal Overlay */}
        {showLegalDoc && (
          <div className="fixed inset-0 z-[110] bg-background">
            <LegalDocuments type={showLegalDoc} onBack={() => setShowLegalDoc(null)} />
          </div>
        )}
      </div>
    </CustomBackground>
  );
}
