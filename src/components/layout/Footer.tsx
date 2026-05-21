import { Zap, Twitter, Instagram, Github } from "lucide-react";
import simvaLogoImg from "../../assets/images/simva_logo_oficial.png";

export function Footer() {
  return (
    <footer className="border-t bg-background py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <img src={simvaLogoImg} alt="SIMVA Logo" className="h-8 w-8 object-contain" />
              <span className="font-heading text-lg font-bold tracking-tight text-primary">
                SIMVA
              </span>
            </div>
            <p className="text-muted-foreground max-w-sm mb-6">
              La plataforma líder en España para la gestión rápida y segura de trámites de vehículos. 
              Impulsando la digitalización del sector automovilista.
            </p>
            <div className="flex gap-4">
              <a href="#" className="p-2 border rounded-full hover:bg-muted transition-colors"><Twitter className="h-4 w-4" /></a>
              <a href="#" className="p-2 border rounded-full hover:bg-muted transition-colors"><Instagram className="h-4 w-4" /></a>
              <a href="#" className="p-2 border rounded-full hover:bg-muted transition-colors"><Github className="h-4 w-4" /></a>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-6">Servicios</h4>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">Registro de Vehículos</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Informes de Tráfico</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Cambio de Titularidad</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Duplicados Permiso</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6">Legal</h4>
            <ul className="space-y-4 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">Privacidad</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Términos y Condiciones</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Política de Cookies</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Contacto</a></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-12 border-t text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} SIMVA S.L. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
