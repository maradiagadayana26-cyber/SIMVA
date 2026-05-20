import React from "react";

interface CustomBackgroundProps {
  children: React.ReactNode;
}

export const CustomBackground: React.FC<CustomBackgroundProps> = ({ children }) => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0A2F44] selection:bg-primary/30">
      {/* Main Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{ backgroundImage: 'url("/src/assets/images/SIMVA.png")' }}
      />
      
      {/* Decorative Text Overlays (Watermark style) */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden text-white/5 font-black uppercase italic select-none">
        {/* Top Left Branding */}
        <div className="absolute top-8 left-8 space-y-1">
          <p className="text-[10px] tracking-widest text-[#CCC]">ITV - INSPECCIÓN TÉCNICA DE VEHÍCULOS</p>
          <p className="text-[10px] tracking-widest text-[#CCC]">CONTROL DE TRÁFICO</p>
          <p className="text-3xl font-heading text-white">BIENVENIDOS</p>
        </div>

        {/* Center Floating SIMVA */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center opacity-10">
          <h1 className="text-[12rem] leading-none tracking-tighter text-[#F5B81B]">SIMVA</h1>
          <p className="text-4xl mt-[-2rem]">VENTURA-SUAVE</p>
          <p className="text-4xl">COFFELETE</p>
        </div>

        {/* Bottom Right Details */}
        <div className="absolute bottom-8 right-8 text-right space-y-1">
          <p className="text-[10px] tracking-widest text-[#CCC]">LINEA 4 - INSPECCIÓN</p>
          <p className="text-[10px] tracking-widest text-[#CCC]">ENTRADA ITV</p>
          <div className="font-mono text-[10px] text-[#AAA] mt-4">
            <p>simva</p>
            <p>DES-2026-E01</p>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="relative z-20 flex flex-col min-h-screen">
        {children}
      </div>
    </div>
  );
};
