import React, { useEffect, useState } from 'react';
import { Smartphone, Apple, Play, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SimvaLogo } from '../icons/SimvaLogo';

interface AppDownloadSectionProps {
  className?: string;
  variant?: 'inline' | 'banner';
}

export function AppDownloadSection({ className, variant = 'inline' }: AppDownloadSectionProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window as any).navigator.standalone === true;

    setIsStandalone(standalone);
    
    if (isIOS) setPlatform('ios');
    else if (isAndroid) setPlatform('android');
    else setPlatform('desktop');
  }, []);

  if (isStandalone || !isVisible) return null;

  if (variant === 'banner') {
    return (
      <div className={cn(
        "bg-primary text-primary-foreground p-4 relative overflow-hidden flex items-center justify-between",
        className
      )}>
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl">
             <SimvaLogo className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Lleva a SIMVA en tu móvil</p>
            <p className="text-xs opacity-90">Recibe alertas al instante y controla tu garaje.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" className="h-8 text-xs font-bold rounded-lg" onClick={() => window.open('#', '_blank')}>
            Descargar
          </Button>
          <button onClick={() => setIsVisible(false)} className="p-1 hover:bg-white/10 rounded-full">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-card border-2 rounded-3xl p-6 text-center space-y-4 shadow-xl shadow-primary/5",
      className
    )}>
      <div className="relative inline-block">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-amber-500 rounded-full blur opacity-20"></div>
        <div className="relative bg-background p-4 rounded-full border-2 border-primary/20">
          <Smartphone className="h-8 w-8 text-primary" />
        </div>
      </div>
      
      <div>
        <h3 className="text-xl font-black font-heading leading-tight italic">
          ¿Usas SIMVA desde la web?
        </h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-[280px] mx-auto">
          Descarga la app nativa para una experiencia más rápida y segura.
        </p>
      </div>

      <div className="flex flex-col gap-2 pt-2">
        {(platform === 'ios' || platform === 'desktop') && (
          <Button 
            className="w-full bg-black text-white hover:bg-black/80 rounded-2xl h-14 flex items-center justify-center gap-3 font-bold"
            onClick={() => window.open('https://apps.apple.com', '_blank')}
          >
            <Apple className="h-6 w-6" />
            <div className="text-left leading-none">
              <div className="text-[10px] uppercase font-medium opacity-70">Descargar en</div>
              <div className="text-lg">App Store</div>
            </div>
          </Button>
        )}

        {(platform === 'android' || platform === 'desktop') && (
          <Button 
            className="w-full bg-slate-800 text-white hover:bg-slate-700 rounded-2xl h-14 flex items-center justify-center gap-3 font-bold"
            onClick={() => window.open('https://play.google.com', '_blank')}
          >
            <Play className="h-6 w-6 fill-current" />
            <div className="text-left leading-none">
              <div className="text-[10px] uppercase font-medium opacity-70">Consíguelo en</div>
              <div className="text-lg">Google Play</div>
            </div>
          </Button>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground mt-4">
        O instala la <button className="underline font-medium hover:text-primary">versión web (PWA)</button> directamente
      </p>
    </div>
  );
}
