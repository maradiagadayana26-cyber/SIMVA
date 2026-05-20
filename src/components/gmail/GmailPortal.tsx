import React, { useState, useEffect } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "@/src/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mail, 
  Send, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  Lock, 
  Inbox, 
  X, 
  Sparkles, 
  ChevronRight, 
  ArrowRight,
  FileText
} from "lucide-react";
import { toast } from "sonner";

interface GmailMessage {
  id: string;
  threadId: string;
}

interface ParsedMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
}

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number | string;
  vin?: string;
  plates?: string;
}

export function GmailPortal() {
  const { user, accessToken, setAccessToken } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  // Gmail list States
  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("SIMVA OR coche OR taller OR ITV OR mantenimiento");
  
  // Compose Email States
  const [recipient, setRecipient] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  
  // Selected Message view modal
  const [selectedMessage, setSelectedMessage] = useState<ParsedMessage | null>(null);
  const [loadingMessageBody, setLoadingMessageBody] = useState(false);
  
  // Fetch user vehicles to populate templates
  useEffect(() => {
    if (!user) return;
    const fetchVehicles = async () => {
      try {
        const q = query(collection(db, "vehicles"), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        const list: Vehicle[] = [];
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Vehicle);
        });
        setVehicles(list);
      } catch (err) {
        console.error("Error fetching vehicles for templates:", err);
      }
    };
    fetchVehicles();
  }, [user]);

  // Load list of emails when accessToken is set
  useEffect(() => {
    if (accessToken) {
      fetchInbox();
    }
  }, [accessToken]);

  const handleConnectGmail = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/gmail.readonly");
    provider.addScope("https://www.googleapis.com/auth/gmail.send");
    provider.addScope("https://www.googleapis.com/auth/gmail.modify");
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
        toast.success("¡Gmail vinculado correctamente!");
      } else {
        toast.error("No se pudo obtener el token de acceso.");
      }
    } catch (err: any) {
      console.error("Gmail linking failed:", err);
      toast.error("Vincular con Gmail falló: " + err.message);
    }
  };

  const fetchInbox = async () => {
    if (!accessToken) return;
    setLoadingList(true);
    try {
      const qParam = encodeURIComponent(searchQuery);
      const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${qParam}`;
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (!listRes.ok) {
        if (listRes.status === 401) {
          // Token expired, clear it
          setAccessToken(null);
          toast.error("Tu sesión de Gmail ha expirado. Por favor vincúlala de nuevo.");
          return;
        }
        throw new Error(`Error ${listRes.status} al listar correos`);
      }

      const listData = await listRes.json();
      const rawMessages: GmailMessage[] = listData.messages || [];
      
      // Fetch details in parallel
      const parsedList = await Promise.all(
        rawMessages.map(async (msg) => {
          try {
            const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (!detailRes.ok) return null;
            const detailData = await detailRes.json();
            
            // Extract headers
            const headers: any[] = detailData.payload?.headers || [];
            const subHeader = headers.find(h => h.name.toLowerCase() === "subject");
            const fromHeader = headers.find(h => h.name.toLowerCase() === "from");
            const dateHeader = headers.find(h => h.name.toLowerCase() === "date");
            
            // Body decoding helper
            let mBody = "";
            const payload = detailData.payload;
            if (payload) {
              if (payload.parts) {
                // Find html or plain body
                const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
                const plainPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
                const targetPart = htmlPart || plainPart || payload.parts[0];
                if (targetPart && targetPart.body && targetPart.body.data) {
                  mBody = decodeBase64Url(targetPart.body.data);
                }
              } else if (payload.body && payload.body.data) {
                mBody = decodeBase64Url(payload.body.data);
              }
            }

            return {
              id: msg.id,
              threadId: msg.threadId,
              subject: subHeader ? subHeader.value : "(Sin asunto)",
              from: fromHeader ? fromHeader.value : "Desconocido",
              date: dateHeader ? dateHeader.value : "",
              snippet: detailData.snippet || "",
              body: mBody || detailData.snippet || ""
            };
          } catch (e) {
            console.error(`Error parsing message details ${msg.id}:`, e);
            return null;
          }
        })
      );

      setMessages(parsedList.filter((m): m is ParsedMessage => m !== null));
    } catch (err: any) {
      console.error("Error reading inbox:", err);
      toast.error("Error al sincronizar tu bandeja de entrada");
    } finally {
      setLoadingList(false);
    }
  };

  const decodeBase64Url = (base64urlStr: string) => {
    try {
      let b64 = base64urlStr.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) {
        b64 += "=";
      }
      return decodeURIComponent(
        atob(b64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
    } catch (e) {
      return atob(base64urlStr.replace(/-/g, "+").replace(/_/g, "/"));
    }
  };

  const handleSelectTemplate = (type: "technical" | "itv" | "workshop") => {
    if (vehicles.length === 0) {
      toast.info("No tienes vehículos registrados para completar esta plantilla");
      return;
    }
    const mainVehicle = vehicles[0];
    
    if (type === "technical") {
      setSubject(`Ficha Técnica del coche - SIMVA: ${mainVehicle.brand} ${mainVehicle.model}`);
      setBody(`
        <div style="font-family: sans-serif; max-width: 600px; padding: 24px; border: 1px solid #eee; border-radius: 12px; color: #222;">
          <h2 style="color: #2AC1FF;">Ficha Técnica del Vehículo</h2>
          <p>Sincronizado vía la app <strong>SIMVA</strong> 🦁</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 16px 0;" />
          <table style="width: 100%; text-align: left; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #f6f6f6;"><th style="padding: 8px 0; color: #666;">Marca</th><td style="padding: 8px 0; font-weight: bold;">${mainVehicle.brand}</td></tr>
            <tr style="border-bottom: 1px solid #f6f6f6;"><th style="padding: 8px 0; color: #666;">Modelo</th><td style="padding: 8px 0; font-weight: bold;">${mainVehicle.model}</td></tr>
            <tr style="border-bottom: 1px solid #f6f6f6;"><th style="padding: 8px 0; color: #666;">Año de fabricación</th><td style="padding: 8px 0;">${mainVehicle.year}</td></tr>
            ${mainVehicle.plates ? `<tr style="border-bottom: 1px solid #f6f6f6;"><th style="padding: 8px 0; color: #666;">Matrícula</th><td style="padding: 8px 0;">${mainVehicle.plates}</td></tr>` : ""}
            ${mainVehicle.vin ? `<tr style="border-bottom: 1px solid #f6f6f6;"><th style="padding: 8px 0; color: #666;">Número de Chasis (VIN)</th><td style="padding: 8px 0; font-family: monospace;">${mainVehicle.vin}</td></tr>` : ""}
          </table>
          <p style="margin-top: 24px; font-size: 11px; color: #999; text-align: center;">Este informe técnico fue enviado desde mi cuenta vinculada de SIMVA.</p>
        </div>
      `);
      toast.success("Cargada plantilla de ficha técnica!");
    } else if (type === "itv") {
      setSubject(`Aviso Importante: ITV del Vehículo ${mainVehicle.brand} ${mainVehicle.model}`);
      setBody(`
        <div style="font-family: sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e11d48; border-radius: 12px; color: #222; background-color: #fef2f2;">
          <h2 style="color: #e11d48;">⚠️ Aviso Próxima ITV - SIMVA</h2>
          <p>Este es un aviso automático generado por mi garaje digital. El vehículo <strong>${mainVehicle.brand} ${mainVehicle.model}</strong> tiene programada una próxima inspección ITV.</p>
          <p>Por favor, cerciórese de tener toda la documentación a mano:</p>
          <ul>
            <li>Permiso de Circulación</li>
            <li>Ficha Técnica de Inspección del vehículo</li>
            <li>Justificante de seguro obligatorio vigente</li>
          </tr>
          <p style="font-size: 11px; color: #999; margin-top: 20px;">Gestionado por SIMVA, el león perezoso que todo lo tiene bajo control.</p>
        </div>
      `);
      toast.success("Cargada plantilla de aviso ITV!");
    } else if (type === "workshop") {
      setSubject(`Consulta técnica para el taller - Vehículo ${mainVehicle.brand} ${mainVehicle.model}`);
      setBody(`
        <div style="font-family: sans-serif; max-width: 600px; padding: 24px; border: 1px solid #eee; border-radius: 12px; color: #222;">
          <h2 style="color: #059669;">Consulta de Mantenimiento</h2>
          <p>Estimado taller mecánico,</p>
          <p>Me pongo en contacto para consultar presupuesto de una cita técnica de revisión para mi vehículo:</p>
          <p><strong>Coche:</strong> ${mainVehicle.brand} ${mainVehicle.model} (Año ${mainVehicle.year})</p>
          <p>Me gustaría recibir confirmación de precio y disponibilidad para una revisión general y mantenimiento rutinario de niveles y frenos.</p>
          <p>Quedo a la espera de sus noticias. Muchas gracias.</p>
          <p style="font-size: 11px; color: #999; margin-top: 40px; border-top: 1px solid #eee; pt: 10px;">Atentamente,<br/>${user?.displayName || "Piloto SIMVA"}</p>
        </div>
      `);
      toast.success("Cargada plantilla de consulta para taller!");
    }
  };

  const cleanSubject = (subj: string) => {
    return subj.replace(/^=\?utf-8\?[QB]\?.*?\?=$/gi, "");
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !subject || !body) {
      toast.error("Por favor completa el destinatario, asunto y mensaje");
      return;
    }

    // MANDATORY confirmation dialog for sending emails on behalf of the user (as requested by SKILL.md)
    const confirmed = window.confirm(
      `¿Confirmas que deseas enviar este correo electrónico en tu nombre desde tu cuenta de Gmail (${user?.email}) a ${recipient}?`
    );
    if (!confirmed) return;

    setSending(true);
    try {
      const emailContent = [
        `To: ${recipient}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
        '',
        body
      ].join('\r\n');

      const rawBase64 = btoa(unescape(encodeURIComponent(emailContent)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw: rawBase64 })
      });

      if (!sendRes.ok) {
        throw new Error(`Error ${sendRes.status} al enviar correo`);
      }

      toast.success("¡Correo enviado correctamente desde tu Gmail!");
      
      // Reset compose state, but keep recipient to default
      setSubject("");
      setBody("");
      
      // Refresh inbox list to reflect changes
      fetchInbox();
    } catch (err: any) {
      console.error("Error sending mail:", err);
      toast.error("No se pudo enviar el correo: " + err.message);
    } finally {
      setSending(false);
    }
  };

  if (!accessToken) {
    return (
      <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8 flex flex-col items-center justify-center min-h-[70vh]">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-8 sm:p-12 rounded-3xl border-2 border-white/5 bg-[#1A1D23] max-w-lg text-center space-y-6 shadow-2xl"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <Mail className="h-8 w-8 animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-wider text-white font-heading">
              Portal de Gmail
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed px-2">
              Sincroniza y controla los correos, ITV, recordatorios de mantenimiento y comunica con talleres directamente conectando tu cuenta de Gmail de manera segura.
            </p>
          </div>

          <div className="border border-white/5 bg-black/20 p-4 rounded-2xl text-[11px] text-gray-500 text-left flex gap-3">
            <Lock className="h-5 w-5 text-[#2AC1FF] shrink-0 mt-0.5" />
            <span>
              <strong>Máxima Privacidad:</strong> Tus datos de correo se procesan directamente en el navegador de manera local y transitoria. SIMVA nunca almacena o comparte tu información personal o de correo.
            </span>
          </div>

          <Button 
            onClick={handleConnectGmail}
            className="w-full h-14 rounded-2xl text-base font-black uppercase text-black bg-gradient-to-r from-[#2AC1FF] to-[#54FFB5] hover:opacity-90 active:scale-95 shadow-xl transition-all"
          >
            Vincular Gmail con SIMVA
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Connected Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#54FFB5] flex items-center gap-1.5 mb-1">
            <span className="flex h-1.5 w-1.5 rounded-full bg-[#54FFB5] animate-ping" />
            Conexión de Gmail Activa
          </span>
          <h1 className="text-3xl font-black tracking-tight text-white uppercase italic font-heading">
            Centro de Gmail SIMVA
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white/5 border-2 hover:bg-white/10 text-white rounded-xl h-10 px-4 text-xs font-bold gap-2"
            onClick={fetchInbox}
            disabled={loadingList}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>

          <Button 
            variant="ghost" 
            className="text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl h-10 text-xs font-bold"
            onClick={() => {
              setAccessToken(null);
              toast.info("Conexión de Gmail desvinculada.");
            }}
          >
            Desvincular Gmail
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: GMAIL INBOX */}
        <div className="lg:col-span-7 bg-[#1A1D23] border border-white/5 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Inbox className="h-5 w-5 text-[#2AC1FF]" />
              Bandeja de Entrada
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#2AC1FF]/10 text-[#2AC1FF] uppercase">
              {messages.length} correos
            </span>
          </div>

          {/* Search bar for Gmail query filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar correos (ej: SIMVA, ITV...)" 
                className="pl-10 h-11 border-2 bg-black/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchInbox();
                }}
              />
            </div>
            <Button 
              className="bg-[#2AC1FF] hover:bg-[#2AC1FF]/80 text-black font-black uppercase h-11 px-4 text-xs"
              onClick={fetchInbox}
              disabled={loadingList}
            >
              Buscar
            </Button>
          </div>

          {/* Messages Loader list */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
            {loadingList ? (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="h-8 w-8 text-[#2AC1FF] animate-spin mx-auto" />
                <p className="text-xs text-gray-400 italic">Sincronizando correos...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-2xl p-6 bg-black/10 space-y-3">
                <Mail className="h-10 w-10 text-gray-600 mx-auto" />
                <p className="text-sm font-bold text-gray-400">Ningún correo encontrado</p>
                <p className="text-xs text-gray-600 max-w-sm mx-auto">
                  No se encontraron mensajes que coincidan con "{searchQuery}". Prueba cambiando los términos en el filtro de búsqueda.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id}
                  onClick={() => setSelectedMessage(msg)}
                  className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-[#2AC1FF]/30 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer group flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold text-gray-400 truncate max-w-[150px]">
                        {msg.from.split("<")[0]}
                      </span>
                      <span className="text-[9px] text-gray-600">
                        {new Date(msg.date).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white group-hover:text-[#2AC1FF] transition-colors truncate">
                      {msg.subject}
                    </h4>
                    <p className="text-xs text-gray-400 line-clamp-1 mt-1 font-medium">
                      {msg.snippet}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-[#2AC1FF] shrink-0 self-center transition-colors" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: COMPOSE EMAIL & TEMPLATES */}
        <div className="lg:col-span-5 space-y-6">
          {/* Email Templates quick selections */}
          <div className="bg-[#1A1D23] border border-white/5 p-6 rounded-3xl space-y-4">
            <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#54FFB5]" />
              Plantillas Rápidas SIMVA
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed font-semibold">
              Rellena y envía de forma automática un correo electrónico bien formateado con los datos reales de tu coche:
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => handleSelectTemplate("technical")}
                className="flex items-center justify-between text-left p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-[#2AC1FF]/40 text-xs text-white transition-all group"
              >
                <span className="flex items-center gap-2 font-bold min-w-0">
                  <FileText className="h-4 w-4 text-[#2AC1FF] shrink-0" />
                  <span className="truncate">Ficha Técnica del coche</span>
                </span>
                <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-white transition-colors shrink-0" />
              </button>

              <button 
                onClick={() => handleSelectTemplate("itv")}
                className="flex items-center justify-between text-left p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-red-500/40 text-xs text-white transition-all group"
              >
                <span className="flex items-center gap-2 font-bold min-w-0">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <span className="truncate">Aviso Examen de ITV</span>
                </span>
                <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-white transition-colors shrink-0" />
              </button>

              <button 
                onClick={() => handleSelectTemplate("workshop")}
                className="flex items-center justify-between text-left p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-[#54FFB5]/40 text-xs text-white transition-all group"
              >
                <span className="flex items-center gap-2 font-bold min-w-0">
                  <Mail className="h-4 w-4 text-[#54FFB5]" />
                  <span>Consulta de Presupuesto</span>
                </span>
                <ChevronRight className="h-4 w-4 text-gray-600 group-hover:text-white transition-colors shrink-0" />
              </button>
            </div>
          </div>

          {/* Compose and Send Mail Form */}
          <div className="bg-[#1A1D23] border border-white/5 p-6 rounded-3xl space-y-4">
            <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Send className="h-5 w-5 text-[#54FFB5]" />
              Enviar Correo Electrónico
            </h2>
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">Destinatario (Para)</label>
                <Input 
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="ej: taller@ejemplo.com"
                  className="bg-black/20 border-2 h-11 font-bold text-white text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">Asunto</label>
                <Input 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Asunto del correo..."
                  className="bg-black/20 border-2 h-11 font-bold text-white text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">Contenido (HTML Soportado)</label>
                <textarea 
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Escribe el cuerpo de tu mensaje o selecciona una plantilla superior..."
                  className="bg-black/20 border-2 rounded-2xl p-3 min-h-[160px] text-white text-sm font-medium custom-scrollbar focus:outline-none focus:border-[#2AC1FF] w-full resize-y"
                  required
                />
              </div>

              <Button 
                type="submit"
                disabled={sending}
                className="w-full h-12 bg-gradient-to-r from-[#2AC1FF] to-[#54FFB5] hover:opacity-90 text-black font-black uppercase rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:shadow-primary/10 transition-all mt-3"
              >
                <Send className="h-4 w-4 text-black" />
                {sending ? "Enviando..." : "Enviar Correo"}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* DETAILED MESSAGE SLIDE-IN UNDERLAY MODAL */}
      <AnimatePresence>
        {selectedMessage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#1A1D23] border border-white/10 rounded-3xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-white/5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#2AC1FF]">
                    De: {selectedMessage.from}
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white line-clamp-2 mt-1">
                    {selectedMessage.subject}
                  </h3>
                  <span className="text-[10px] text-gray-500 font-bold block mt-1">
                    Recibido el {new Date(selectedMessage.date).toLocaleString()}
                  </span>
                </div>
                <button 
                  onClick={() => setSelectedMessage(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white rounded-b-3xl">
                {selectedMessage.body.trim().startsWith("<") ? (
                  <div 
                    dangerouslySetInnerHTML={{ __html: selectedMessage.body }}
                    className="prose prose-sm max-w-none text-black"
                  />
                ) : (
                  <pre className="text-xs font-medium text-black whitespace-pre-wrap font-sans">
                    {selectedMessage.body}
                  </pre>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
