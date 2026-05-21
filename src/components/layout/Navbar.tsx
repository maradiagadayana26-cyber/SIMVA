import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import simvaLogoImg from "../../assets/images/simva_logo_oficial.png";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src={simvaLogoImg} alt="SIMVA Logo" className="h-10 w-10 object-contain" />
          <span className="font-heading text-xl font-bold tracking-tight text-primary">
            SIMVA
          </span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-primary transition-colors">Características</a>
          <a href="#process" className="hover:text-primary transition-colors">¿Cómo funciona?</a>
          <a href="#faq" className="hover:text-primary transition-colors">FAQ</a>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" className="hidden sm:inline-flex">Iniciar sesión</Button>
          <Button>Registrar Coche</Button>
        </div>
      </div>
    </nav>
  );
}
