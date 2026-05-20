import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("simva_cookie_consent");
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = (type: 'all' | 'necessary') => {
    localStorage.setItem("simva_cookie_consent", type === 'all' ? 'accepted_all' : 'accepted_necessary');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 z-[200] max-w-4xl mx-auto"
        >
          <div className="bg-[#1A1D23] border border-white/10 rounded-3xl p-6 shadow-2xl shadow-black/50 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#2AC1FF] to-[#54FFB5]" />
            
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
              <div className="bg-white/5 p-3 rounded-2xl border border-white/10 shrink-0">
                <Info className="h-6 w-6 text-[#2AC1FF]" />
              </div>
              
              <div className="space-y-2 flex-1 text-white">
                <h3 className="font-heading text-lg font-bold">Respetamos tu privacidad</h3>
                <p className="text-sm text-gray-400 max-w-2xl">
                  Utilizamos cookies propias y de terceros para mejorar tu experiencia y analizar el uso de nuestra plataforma. Puedes aceptar todas o elegir solo las necesarias para el funcionamiento.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 justify-center md:justify-start">
                  <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 italic">
                    Técnicas: Activas
                  </span>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 italic">
                    Análisis: Pendiente
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 min-w-[240px]">
                <Button 
                  variant="outline" 
                  size="default" 
                  className="border-white/10 text-white hover:bg-white/5 flex-1 h-12 font-bold"
                  onClick={() => handleAccept('necessary')}
                >
                  Solo Necesarias
                </Button>
                <Button 
                  className="bg-gradient-to-r from-[#2AC1FF] to-[#54FFB5] text-black hover:opacity-90 flex-1 h-12 font-bold shadow-lg shadow-[#2AC1FF]/20"
                  onClick={() => handleAccept('all')}
                >
                  Aceptar Todas
                </Button>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center md:justify-start gap-4">
              <button className="text-[10px] uppercase tracking-widest font-black text-gray-500 hover:text-white transition-colors">
                Política de Privacidad
              </button>
              <button className="text-[10px] uppercase tracking-widest font-black text-gray-500 hover:text-white transition-colors">
                Términos de Uso
              </button>
              <button className="text-[10px] uppercase tracking-widest font-black text-gray-500 hover:text-white transition-colors">
                Configurar
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
