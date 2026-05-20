import { LayoutDashboard, PlusCircle, Bell, User, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/src/contexts/NotificationContext";

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const { unreadCount } = useNotifications();

  const tabs = [
    { id: "dashboard", icon: LayoutDashboard, label: "Inicio" },
    { id: "register", icon: PlusCircle, label: "Registrar" },
    { id: "workshops", icon: Wrench, label: "Talleres" },
    { id: "notifications", icon: Bell, label: "Avisos", hasBadge: true },
    { id: "settings", icon: User, label: "Perfil" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-around border-t bg-background/80 px-4 pb-4 backdrop-blur-md lg:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "flex flex-col items-center gap-1 transition-all relative",
            activeTab === tab.id ? "text-primary scale-110" : "text-muted-foreground"
          )}
        >
          <div className={cn(
            "rounded-xl p-2 transition-all",
            activeTab === tab.id ? "bg-primary/10" : ""
          )}>
            <tab.icon className="h-6 w-6" />
            {tab.hasBadge && unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] font-black text-black">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
