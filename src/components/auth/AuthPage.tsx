import React, { useState } from "react";
import { auth, db, handleFirestoreError, OperationType } from "@/src/lib/firebase";
import { useAuth } from "@/src/contexts/AuthContext";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { SimvaLogo } from "@/src/components/icons/SimvaLogo";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Mail, ChevronLeft, ShieldCheck, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { AppDownloadSection } from "@/src/components/ui/AppDownloadSection";
import { LegalDocuments } from "@/src/components/legal/Documents";

type AuthMethod = 'select' | 'email';

export function AuthPage() {
  const { setAccessToken } = useAuth();
  const [method, setMethod] = useState<AuthMethod>('select');
  const [isLogin, setIsLogin] = useState(true);
  
  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showLegal, setShowLegal] = useState<{ type: 'privacy' | 'cookies' | 'terms' | 'notice' } | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  
  const [loading, setLoading] = useState(false);

  const notifyRegistration = async (userEmail: string, userId: string, fullName?: string) => {
    try {
      await fetch("/api/notify-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, userId, fullName })
      });
    } catch (e) {
      console.error("Failed to notify registration:", e);
    }
  };

  const handleEmailAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("¡Bienvenido de nuevo!");
      } else {
        if (!legalAccepted) {
          toast.error("Debes aceptar los términos y la política de privacidad");
          return;
        }
        if (password.length < 6) {
          toast.error("La contraseña debe tener al menos 6 caracteres");
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        try {
          await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            fullName,
            app_theme: "light",
            created_at: serverTimestamp(),
            id: user.uid,
            legal_consent: {
              accepted: legalAccepted,
              accepted_at: serverTimestamp(),
              version: "1.0"
            }
          });
          
          // Notify backend for email sending
          await notifyRegistration(user.email!, user.uid, fullName);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
        }
        
        toast.success("¡Cuenta creada correctamente!");
      }
    } catch (error) {
      toast.error("Error: " + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
    provider.addScope('https://www.googleapis.com/auth/gmail.send');
    provider.addScope('https://www.googleapis.com/auth/gmail.modify');
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setAccessToken(credential.accessToken);
      }
      
      const isNewUser = (result as any)._tokenResponse?.isNewUser;

      try {
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          fullName: user.displayName,
          app_theme: "light",
          created_at: serverTimestamp(),
          id: user.uid
        }, { merge: true });

        if (isNewUser) {
          await notifyRegistration(user.email!, user.uid, user.displayName || undefined);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }
      
      toast.success("Sesión iniciada con Google");
    } catch (error) {
      toast.error("Error con Google: " + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F1115] p-4 sm:p-8">
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[450px] space-y-8"
      >
        {/* Branding & Motivation */}
        <div className="text-center space-y-4">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gray-900 border border-white/10 shadow-inner"
          >
            <SimvaLogo className="h-16 w-16" />
          </motion.div>
          <div className="space-y-1">
            <h1 className="font-heading text-4xl font-black tracking-tight text-white uppercase italic">SIMVA</h1>
            <p className="text-gray-400 font-medium px-4">
              "Un minuto y tu coche estará bajo control. ¡Sin esfuerzo!"
            </p>
          </div>
        </div>

        <Card className="border-2 border-white/5 bg-[#1A1D23] shadow-2xl shadow-black/50 overflow-hidden">
          <CardContent className="p-0">
            <AnimatePresence mode="wait">
              {method === 'select' && (
                <motion.div
                  key="select"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-8 space-y-6 text-white"
                >
                  <div className="space-y-2 text-center">
                    <h2 className="text-2xl font-bold font-heading">
                      {isLogin ? "¡Hola de nuevo!" : "Únete a Simva"}
                    </h2>
                    <p className="text-sm text-gray-400">
                      {isLogin ? "Elige cómo quieres entrar a tu garaje" : "Elige un método para empezar a cuidar tu coche"}
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <Button 
                      variant="outline" 
                      className="h-14 text-lg font-bold gap-3 border-2 border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#2AC1FF] transition-all text-white"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                    >
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-6 w-6" />
                      Continuar con Google
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="h-14 text-lg font-bold gap-3 border-2 border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#2AC1FF] transition-all text-white"
                      onClick={() => setMethod('email')}
                    >
                      <Mail className="h-6 w-6 text-[#2AC1FF]" />
                      Continuar con Email
                    </Button>
                  </div>

                  <div className="text-center pt-4 border-t">
                    <button 
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-sm font-bold text-primary hover:underline"
                    >
                      {isLogin ? "¿No tienes cuenta? Regístrate aquí" : "¿Ya tienes cuenta? Inicia sesión"}
                    </button>
                  </div>
                </motion.div>
              )}

              {method === 'email' && (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-8 space-y-6"
                >
                  <button onClick={() => setMethod('select')} className="flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Volver
                  </button>
                  
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold font-heading">
                      {isLogin ? "Entrar con Email" : "Registro con Email"}
                    </h2>
                    <form onSubmit={handleEmailAction} className="space-y-4">
                      {!isLogin && (
                        <div className="space-y-2">
                          <Label htmlFor="fullName">Nombre Completo</Label>
                          <Input 
                            id="fullName" 
                            type="text" 
                            placeholder="Tu nombre" 
                            className="h-12 border-2"
                            required={!isLogin} 
                            value={fullName} 
                            onChange={e => setFullName(e.target.value)} 
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          placeholder="tu@email.com" 
                          className="h-12 border-2"
                          required 
                          value={email} 
                          onChange={e => setEmail(e.target.value)} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input 
                          id="password" 
                          type="password" 
                          className="h-12 border-2"
                          required 
                          value={password} 
                          onChange={e => setPassword(e.target.value)} 
                        />
                        {!isLogin && <p className="text-[10px] text-muted-foreground">Mínimo 6 caracteres</p>}
                      </div>

                      {!isLogin && (
                        <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 group cursor-pointer" onClick={() => setLegalAccepted(!legalAccepted)}>
                          <div className={cn(
                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all",
                            legalAccepted ? "bg-[#2AC1FF] border-[#2AC1FF]" : "border-white/20 group-hover:border-white/40"
                          )}>
                            {legalAccepted && <CheckCircle2 className="h-4 w-4 text-black" />}
                          </div>
                          <div className="text-[11px] leading-relaxed text-gray-400">
                            He leído y acepto los <button type="button" onClick={(e) => { e.stopPropagation(); setShowLegal({ type: 'privacy' }); }} className="text-[#2AC1FF] hover:underline font-bold">Términos de Uso</button> y la <button type="button" onClick={(e) => { e.stopPropagation(); setShowLegal({ type: 'privacy' }); }} className="text-[#2AC1FF] hover:underline font-bold">Política de Privacidad</button> de SIMVA 🦁.
                          </div>
                        </div>
                      )}

                      <Button type="submit" className="w-full h-14 text-lg font-bold bg-gradient-to-r from-[#2AC1FF] to-[#54FFB5] text-black shadow-xl shadow-[#2AC1FF]/20" disabled={loading}>
                        {loading ? "Procesando..." : isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
                      </Button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
          <CardFooter className="bg-black/20 p-4 border-t border-white/5 flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#54FFB5]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Grado de Seguridad Industrial Especializado</span>
          </CardFooter>
        </Card>

        <AppDownloadSection className="mt-8" />

        <footer className="mt-12 text-center space-y-4">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] uppercase tracking-[0.2em] font-black text-gray-500">
            <button onClick={() => setShowLegal({ type: 'notice' })} className="hover:text-[#2AC1FF] transition-colors">Aviso Legal</button>
            <button onClick={() => setShowLegal({ type: 'privacy' })} className="hover:text-[#2AC1FF] transition-colors">Privacidad</button>
            <button onClick={() => setShowLegal({ type: 'terms' })} className="hover:text-[#2AC1FF] transition-colors">Términos</button>
            <button onClick={() => setShowLegal({ type: 'cookies' })} className="hover:text-[#2AC1FF] transition-colors">Cookies</button>
          </div>
          <p className="text-[10px] text-gray-600 font-medium">
            &copy; 2026 SIMVA. Todos los derechos reservados.
          </p>
        </footer>
      </motion.div>

      <AnimatePresence>
        {showLegal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1A1D23] border border-white/10 rounded-3xl w-full max-w-2xl h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-white uppercase italic tracking-wider">Documento Legal</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowLegal(null)} className="text-gray-400 hover:text-white">
                  Cerrar
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <LegalDocuments type={showLegal.type} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
