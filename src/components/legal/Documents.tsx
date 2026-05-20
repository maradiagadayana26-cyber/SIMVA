import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export type LegalDocType = 'privacy' | 'cookies' | 'terms' | 'notice';

interface LegalDocumentsProps {
  type: LegalDocType;
  onBack?: () => void;
}

export function LegalDocuments({ type, onBack }: LegalDocumentsProps) {
  const content = {
    privacy: (
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h1 className="text-2xl font-black text-foreground uppercase italic tracking-tight">Política de Privacidad</h1>
        <p className="font-bold text-foreground italic underline">Última actualización: 13 de mayo de 2026</p>
        
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">1.1. Responsable del tratamiento</h2>
          <p><strong>SIMVA 🦁</strong></p>
          <p>Email de contacto: <a href="mailto:dpo@simva.com" className="text-[#2AC1FF] underline">dpo@simva.com</a></p>
          <p>Sitio web: <a href="https://www.simva.com" target="_blank" className="text-[#2AC1FF] underline">www.simva.com</a></p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">1.2. ¿Qué datos personales recogemos?</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Datos de identificación</strong>: nombre completo, correo electrónico.</li>
            <li><strong>Datos del vehículo</strong>: marca, modelo, año, combustible, tipo de motor, frecuencia de mantenimiento, kilometraje actual, fecha del último mantenimiento.</li>
            <li><strong>Imágenes</strong>: fotos de la ficha técnica del vehículo (solo si el usuario las proporciona voluntariamente).</li>
            <li><strong>Datos de uso</strong>: preferencias de tema (claro/oscuro), interacciones con la app.</li>
            <li><strong>Datos técnicos</strong>: dirección IP, tipo de dispositivo, sistema operativo, identificadores de notificaciones push.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">1.3. Finalidades del tratamiento</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-white/10 text-left text-xs">
              <thead>
                <tr className="bg-white/5">
                  <th className="p-2 border border-white/10">Finalidad</th>
                  <th className="p-2 border border-white/10">Base legal</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border border-white/10">Gestionar tu cuenta de usuario y permitir el acceso a la app</td>
                  <td className="p-2 border border-white/10">Ejecución de un contrato</td>
                </tr>
                <tr className="bg-white/5">
                  <td className="p-2 border border-white/10">Registrar y mantener los datos de tu vehículo para enviarte recordatorios de mantenimiento</td>
                  <td className="p-2 border border-white/10">Ejecución de un contrato</td>
                </tr>
                <tr>
                  <td className="p-2 border border-white/10">Enviarte notificaciones (push, email) sobre el estado de tu vehículo y recordatorios</td>
                  <td className="p-2 border border-white/10">Interés legítimo / consentimiento (para push)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">1.7. Tus derechos (RGPD)</h2>
          <p>Puedes ejercer gratuitamente los siguientes derechos escribiendo a <strong>dpo@simva.com</strong> o desde la sección <strong>Perfil &gt; Privacidad</strong>:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Acceso</strong>, <strong>Rectificación</strong>, <strong>Supresión</strong> (derecho al olvido).</li>
            <li><strong>Oposición</strong>, <strong>Limitación del tratamiento</strong>, <strong>Portabilidad</strong>.</li>
            <li><strong>Retirar el consentimiento</strong> en cualquier momento.</li>
          </ul>
        </section>

        <p className="pt-4 border-t border-white/10 italic">SIMVA se compromete con la seguridad de tus datos mediante cifrado TLS y acceso restringido.</p>
      </div>
    ),
    cookies: (
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h1 className="text-2xl font-black text-foreground uppercase italic tracking-tight">Política de Cookies</h1>
        <p className="italic underline">Aplicable a la versión web y PWA de SIMVA 🦁</p>
        
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">2.2. Tipos de cookies que utilizamos</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-white/10 text-left text-xs">
              <thead>
                <tr className="bg-white/5">
                  <th className="p-2 border border-white/10">Tipo</th>
                  <th className="p-2 border border-white/10">Finalidad</th>
                  <th className="p-2 border border-white/10">Consentimiento</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border border-white/10 font-bold">Técnicas</td>
                  <td className="p-2 border border-white/10">Autenticación, guardar el tema...</td>
                  <td className="p-2 border border-white/10 font-bold text-green-400">Innecesario</td>
                </tr>
                <tr className="bg-white/5">
                  <td className="p-2 border border-white/10 font-bold">Preferencias</td>
                  <td className="p-2 border border-white/10">Recordar fondo e idioma</td>
                  <td className="p-2 border border-white/10 font-bold text-green-400">Innecesario</td>
                </tr>
                <tr>
                  <td className="p-2 border border-white/10 font-bold">Análisis</td>
                  <td className="p-2 border border-white/10">Estadísticas anónimas</td>
                  <td className="p-2 border border-white/10 font-bold text-[#2AC1FF]">Necesario</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">2.3. Gestionar tus cookies</h2>
          <p>Al entrar por primera vez, mostramos un <strong>banner</strong> con opciones. Puedes cambiar tus preferencias en cualquier momento desde el enlace "Preferencias de cookies" en el pie de página.</p>
        </section>
      </div>
    ),
    terms: (
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h1 className="text-2xl font-black text-foreground uppercase italic tracking-tight">Términos y Condiciones</h1>
        <p className="font-bold text-foreground italic underline">Versión 1.0 – 13 de mayo de 2026</p>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">3.1. Aceptación de los términos</h2>
          <p>Al registrarte y usar la app SIMVA 🦁, aceptas estos Términos y Condiciones. Si no estás de acuerdo, no debes usar la app.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">3.2. Descripción del servicio</h2>
          <p>SIMVA permite registrar datos del vehículo y recibir recordatorios. La app no realiza reparaciones ni diagnósticos; solo ofrece avisos orientativos. El mantenimiento real es responsabilidad del usuario.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">3.3. Registro</h2>
          <p>Debes ser <strong>mayor de 14 años</strong>. Debes proporcionar datos veraces y eres responsable de tu contraseña.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">3.5. Limitación de responsabilidad</h2>
          <p>SIMVA no se hace responsable de fallos en el envío de notificaciones ni de decisiones tomadas basándose en los recordatorios.</p>
        </section>
        
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">3.9. Ley aplicable</h2>
          <p>Estos términos se rigen por la ley española. Jurisdicción en los tribunales de <strong>Madrid</strong>, España.</p>
        </section>
      </div>
    ),
    notice: (
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h1 className="text-2xl font-black text-foreground uppercase italic tracking-tight">Aviso Legal (LSSI)</h1>
        
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">Datos identificativos</h2>
          <ul className="space-y-1">
            <li><strong>Titular</strong>: SIMVA 🦁 (Nombre comercial)</li>
            <li><strong>Email</strong>: <a href="mailto:hola@simva.com" className="text-[#2AC1FF] underline">hola@simva.com</a></li>
            <li><strong>Domicilio</strong>: Madrid, España.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">Condiciones de uso</h2>
          <p>El acceso al sitio web es gratuito. El usuario se compromete a hacer un uso lícito y a no dañar los sistemas.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">Propiedad intelectual</h2>
          <p>Todos los contenidos (textos, imágenes, logotipos) son propiedad de SIMVA o de sus licenciantes.</p>
        </section>
      </div>
    )
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {onBack && (
        <div className="p-4 border-b flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="font-bold">
            <ChevronLeft className="mr-1 h-4 w-4" /> Volver
          </Button>
        </div>
      )}
      <ScrollArea className="flex-1 p-6 sm:p-10">
        <div className="max-w-2xl mx-auto">
          {content[type]}
        </div>
      </ScrollArea>
    </div>
  );
}
