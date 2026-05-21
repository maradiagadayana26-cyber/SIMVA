import { motion } from "motion/react";
import { SimvaLogo } from "@/src/components/icons/SimvaLogo";
import simvaBg from "../../assets/images/SIMVA.png";

export function Splash() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0A2F44] text-white">
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-10"
        style={{ backgroundImage: `url(${simvaBg})` }}
      />
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10"
      >
        <div className="absolute -inset-12 rounded-full bg-primary/20 blur-3xl animate-pulse" />
        <SimvaLogo className="h-40 w-40 relative z-10" />
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="mt-12 text-center relative z-10"
      >
        <h1 className="font-heading text-6xl font-black tracking-tighter text-white uppercase italic">
          SIMVA
        </h1>
        <div className="mt-4 flex flex-col gap-1 items-center max-w-md mx-auto">
          <p className="text-xs font-bold text-[#2AC1FF] uppercase tracking-wider text-center px-6 leading-relaxed">
            Sistema Inteligente para el Mantenimiento de Vehículos Automatizado
          </p>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.4em] mt-2">
            Automotive Intelligence
          </p>
          <div className="h-[2px] w-12 bg-primary/50 mt-2" />
        </div>
      </motion.div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-3 z-10">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 1, 0.3]
            }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              delay: i * 0.3
            }}
            className="h-1.5 w-1.5 rounded-full bg-primary"
          />
        ))}
      </div>
    </div>
  );
}
