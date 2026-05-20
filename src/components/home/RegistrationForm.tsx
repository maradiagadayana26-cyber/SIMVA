import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Car, User, CreditCard, ChevronRight, ChevronLeft, CheckCircle2, ShieldCheck } from "lucide-react";

type Step = "vehicle" | "owner" | "payment" | "success";

export function RegistrationForm() {
  const [step, setStep] = useState<Step>("vehicle");
  const [formData, setFormData] = useState({
    plate: "",
    vin: "",
    fullName: "",
    dni: "",
    email: ""
  });

  const nextStep = () => {
    if (step === "vehicle") setStep("owner");
    else if (step === "owner") setStep("payment");
    else if (step === "payment") setStep("success");
  };

  const prevStep = () => {
    if (step === "owner") setStep("vehicle");
    else if (step === "payment") setStep("owner");
  };

  return (
    <section id="register" className="container mx-auto px-4 py-20">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex justify-between px-4">
          {[
            { id: "vehicle", icon: Car, label: "Vehículo" },
            { id: "owner", icon: User, label: "Propietario" },
            { id: "payment", icon: CreditCard, label: "Pago" }
          ].map((s, idx) => (
            <div key={s.id} className="flex flex-col items-center gap-2">
              <div 
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                  step === s.id ? "border-primary bg-primary text-primary-foreground scale-110 shadow-lg" : 
                  idx < ["vehicle", "owner", "payment"].indexOf(step) ? "border-primary bg-primary/20 text-primary" : "border-muted text-muted-foreground"
                }`}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <span className={`text-xs font-semibold ${step === s.id ? "text-primary" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <Card className="overflow-hidden border-2 shadow-2xl">
          <AnimatePresence mode="wait">
            {step === "vehicle" && (
              <motion.div
                key="vehicle"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <CardHeader>
                  <CardTitle className="font-heading text-2xl">Datos del Vehículo</CardTitle>
                  <CardDescription>Introduce la matrícula para identificar tu coche al instante.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="plate">Matrícula</Label>
                    <div className="relative">
                      <Input 
                        id="plate" 
                        placeholder="1234 ABC" 
                        className="h-14 text-xl font-bold uppercase tracking-widest pl-12"
                        value={formData.plate}
                        onChange={(e) => setFormData({...formData, plate: e.target.value})}
                      />
                      <Car className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Ejemplo: 2048 GHJ</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vin">Bastidor (VIN) - Opcional</Label>
                    <Input 
                      id="vin" 
                      placeholder="Número de bastidor completo" 
                      value={formData.vin}
                      onChange={(e) => setFormData({...formData, vin: e.target.value})}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button onClick={nextStep} className="w-full h-12" disabled={!formData.plate}>
                    Siguiente paso
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </motion.div>
            )}

            {step === "owner" && (
              <motion.div
                key="owner"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <CardHeader>
                  <CardTitle className="font-heading text-2xl">Datos del Propietario</CardTitle>
                  <CardDescription>Necesitamos estos datos para formalizar el registro oficial.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nombre Completo</Label>
                    <Input 
                      id="fullName" 
                      placeholder="Juan Pérez García" 
                      value={formData.fullName}
                      onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dni">DNI / NIE</Label>
                      <Input 
                        id="dni" 
                        placeholder="12345678A" 
                        value={formData.dni}
                        onChange={(e) => setFormData({...formData, dni: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="juan@ejemplo.com" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-4">
                  <Button variant="outline" onClick={prevStep} className="h-12 px-6">
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Atrás
                  </Button>
                  <Button onClick={nextStep} className="flex-1 h-12" disabled={!formData.fullName || !formData.dni}>
                    Siguiente paso
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </motion.div>
            )}

            {step === "payment" && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <CardHeader>
                  <CardTitle className="font-heading text-2xl">Confirmación y Pago</CardTitle>
                  <CardDescription>Estás a un paso de completar tu registro.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tasa Administrativa:</span>
                      <span className="font-bold">29,90 €</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">IVA (21%):</span>
                      <span className="font-bold">6,28 €</span>
                    </div>
                    <div className="my-2 h-px bg-border" />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-primary font-heading">36,18 €</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 rounded-md bg-primary/5 text-primary text-xs border border-primary/20">
                    <ShieldCheck className="h-4 w-4" />
                    Pago 100% seguro con encriptación bancaria SSL.
                  </div>
                </CardContent>
                <CardFooter className="flex gap-4">
                  <Button variant="outline" onClick={prevStep} className="h-12 px-6">
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Atrás
                  </Button>
                  <Button onClick={nextStep} className="flex-1 h-12 text-lg">
                    Pagar y Finalizar
                  </Button>
                </CardFooter>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div
                key="success"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="p-8 text-center"
              >
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <h2 className="font-heading text-3xl font-bold">¡Registro Iniciado!</h2>
                <p className="mt-4 text-muted-foreground">
                  Hemos enviado un correo a <span className="font-semibold">{formData.email}</span> con los detalles de tu registro.
                  En menos de 24 horas recibirás toda la documentación.
                </p>
                <Button className="mt-8 w-full h-12" onClick={() => window.location.reload()}>
                  Volver al inicio
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </section>
  );
}
