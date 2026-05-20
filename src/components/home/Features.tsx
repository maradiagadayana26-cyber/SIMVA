import { Shield, Zap, Heart, Check, Users, Award } from "lucide-react";
import { motion } from "motion/react";

const features = [
  {
    title: "Velocidad Extrema",
    description: "Nuestra plataforma está optimizada para que completes cualquier trámite en menos de un minuto.",
    icon: Zap,
    color: "text-amber-500",
    bg: "bg-amber-500/10"
  },
  {
    title: "Seguridad Bancaria",
    description: "Tus datos personales y bancarios están protegidos con encriptación de nivel militar.",
    icon: Shield,
    color: "text-blue-500",
    bg: "bg-blue-500/10"
  },
  {
    title: "Atención 24/7",
    description: "Tenemos un equipo de expertos listos para ayudarte en cualquier momento del día o de la noche.",
    icon: Heart,
    color: "text-rose-500",
    bg: "bg-rose-500/10"
  },
  {
    title: "Tramitación Oficial",
    description: "Conexión directa con los registros oficiales para garantizar la validez legal de cada proceso.",
    icon: Award,
    color: "text-purple-500",
    bg: "bg-purple-500/10"
  },
  {
    title: "Miles de Usuarios",
    description: "Más de 50.000 conductores ya confían en SIMVA para sus gestiones automovilistas.",
    icon: Users,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10"
  },
  {
    title: "Transparencia Total",
    description: "Sin letras pequeñas ni costes ocultos. Sabrás exactamente qué pagas desde el primer momento.",
    icon: Check,
    color: "text-sky-500",
    bg: "bg-sky-500/10"
  }
];

export function Features() {
  return (
    <section id="features" className="bg-muted/50 py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-heading text-4xl font-bold mb-4">Por qué elegir SIMVA</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Combinamos tecnología punta con la fuerza operativa de un equipo experto para ofrecerte la mejor experiencia.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="p-8 bg-background rounded-3xl border shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={`h-12 w-12 rounded-2xl ${feature.bg} flex items-center justify-center mb-6`}>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
