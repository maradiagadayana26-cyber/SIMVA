import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Zap, ShieldCheck, Clock } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background py-20 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary"
          >
            <Zap className="h-4 w-4" />
            <span>Registro Express 2026</span>
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 font-heading text-5xl font-extrabold tracking-tight sm:text-7xl lg:max-w-3xl"
          >
            Registra tu coche en <span className="text-primary">60 segundos</span>.
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
          >
            Con la precisión que tu coche merece. Olvídate de la burocracia interminable.
            Procesamos tu registro de vehículo de forma instantánea y segura.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col gap-4 sm:flex-row"
          >
            <Button size="lg" className="h-14 px-8 text-lg font-semibold shadow-xl shadow-primary/20">
              Comenzar Registro Ahora
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-semibold">
              Ver Tarifas
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="mt-12 flex flex-wrap justify-center gap-8 lg:justify-start"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Oficial & Seguro</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Proceso en 1 Minuto</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Soporte 24/7</span>
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute right-0 top-1/2 -z-10 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute left-0 bottom-0 -z-10 h-[300px] w-[300px] -translate-x-1/2 translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
    </section>
  );
}
