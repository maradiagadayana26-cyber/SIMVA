import { useAuth } from "@/src/contexts/AuthContext";
import { useNotifications } from "@/src/contexts/NotificationContext";
import { SimvaLogo } from "@/src/components/icons/SimvaLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Bell, 
  PlusCircle, 
  Wrench,
  Mail
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();

  const menuItems = [
    { id: "dashboard", label: "Mi Vehículo", icon: LayoutDashboard },
    { id: "register", label: "Registrar Nuevo", icon: PlusCircle },
    { id: "workshops", label: "Talleres Cercanos", icon: Wrench },
    { id: "gmail", label: "Centro de Gmail", icon: Mail },
    { id: "notifications", label: "Notificaciones", icon: Bell, hasBadge: true },
    { id: "settings", label: "Ajustes", icon: Settings },
  ];

  return (
    <div className="hidden h-screen w-72 flex-col border-r bg-[#0F1115] text-white lg:flex">
      <div className="flex h-20 items-center gap-3 px-8 border-b border-white/5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 border border-white/10 shadow-inner">
          <SimvaLogo className="h-7 w-7" />
        </div>
        <span className="font-heading text-2xl font-black tracking-tight text-white uppercase italic">
          simva
        </span>
      </div>

      <div className="flex-1 space-y-2 py-8 px-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all relative",
              activeTab === item.id 
                ? "bg-gradient-to-r from-[#2AC1FF] to-[#54FFB5] text-black shadow-lg shadow-[#2AC1FF]/20" 
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="flex-1 text-left">{item.label}</span>
            {item.hasBadge && unreadCount > 0 && (
              <Badge className="bg-primary text-black font-black text-[10px] h-5 min-w-[20px] justify-center px-1">
                {unreadCount}
              </Badge>
            )}
          </button>
        ))}
      </div>

      <div className="mt-auto p-4 border-t border-white/5 bg-black/10">
        <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl bg-white/5">
          <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
            <span className="text-sm font-bold text-white uppercase">
              {profile?.email?.[0] || "U"}
            </span>
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-bold truncate">{profile?.email}</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Piloto Simva</span>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-xl"
          onClick={() => signOut()}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
}
