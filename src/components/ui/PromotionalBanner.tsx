import React from 'react';
import { motion } from 'motion/react';
import { Smartphone, Zap, ShieldCheck } from 'lucide-react';
import { SimvaLogo } from '../icons/SimvaLogo';
import phoneImage from '../../assets/images/phone_with_lion_app_mockup_1779216629488.png';
import simvaLogo from '../../assets/images/simva_logo_oficial.png';

export function PromotionalBanner() {
  return (
    <div className="w-full flex flex-col items-center justify-center py-12 px-6 space-y-16">
      {/* Lleva SIMVA en tu móvil Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="flex flex-col items-center text-center max-w-md w-full"
      >
        <h2 className="text-2xl font-black font-heading tracking-tight italic text-primary flex items-center gap-2 mb-8">
          <Smartphone className="h-6 w-6" />
          Lleva SIMVA en tu móvil
        </h2>
        
        <div className="relative group perspective-1000">
          <div className="absolute -inset-10 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <motion.img 
            src={phoneImage} 
            alt="Simva Mobile App" 
            className="w-64 h-64 object-contain relative z-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
            referrerPolicy="no-referrer"
          />
        </div>

        <p className="mt-8 text-white font-medium text-lg leading-relaxed shadow-sm">
          Descarga la app y cuida tu coche desde cualquier lugar
        </p>
        
        <div className="mt-6 flex gap-4 text-xs font-black uppercase tracking-widest italic text-white/40">
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Rápido</span>
          <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Seguro</span>
        </div>
      </motion.div>

      {/* Decorative Divider */}
      <div className="w-32 h-1 bg-white/10 rounded-full" />

      {/* SIMVA GARAJE Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center text-center max-w-md w-full"
      >
        <div className="bg-white/5 p-8 rounded-[3rem] border-2 border-white/10 backdrop-blur-md shadow-2xl relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
            <SimvaLogo className="h-32 w-32 -mr-8 -mt-8 rotate-12" />
          </div>
          
          <img 
            src={simvaLogo} 
            alt="Simva Logo" 
            className="w-24 h-24 object-contain mx-auto mb-6 relative z-10 drop-shadow-2xl"
            referrerPolicy="no-referrer"
          />
          <h2 className="text-4xl font-black font-heading tracking-tighter italic text-primary uppercase relative z-10">
            SIMVA GARAJE
          </h2>
          <p className="mt-6 text-white font-bold uppercase tracking-widest text-[10px] sm:text-xs relative z-10 leading-relaxed max-w-[300px] mx-auto opacity-90">
            Sistema Inteligente para el Mantenimiento de Vehículos Automatizado
          </p>
        </div>
      </motion.div>
    </div>
  );
}
