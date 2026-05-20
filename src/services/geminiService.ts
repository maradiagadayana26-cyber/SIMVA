import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

export async function generateEmailContent(type: 'welcome' | 'maintenance', data: any) {
  try {
    let prompt = "";
    
    if (type === 'welcome') {
      prompt = `Eres un asistente leonino llamado SIMVA 🦁. Escribe un email de bienvenida cálido, divertido y profesional para un nuevo usuario que acaba de registrarse. 
      Email del usuario: ${data.email}. 
      Tono: "León perezoso pero eficiente". 
      Asunto sugerido: 🦁 Bienvenido a SIMVA.
      Cuerpo: Dale las gracias y recuérdale que registre su vehículo para que el león pueda vigilarlo mientras él duerme.`;
    } else {
      prompt = `Eres un asistente leonino llamado SIMVA 🦁. Escribe un email de alerta de mantenimiento para un usuario.
      Vehículo: ${data.brand} ${data.model}.
      Kilómetros actuales: ${data.currentKms}.
      Frecuencia de mantenimiento: cada ${data.maintenanceFrequency} km.
      Tono: "León perezoso que se ha despertado para avisarte de algo importante".
      Asunto sugerido: 🔧 Tu coche necesita mantenimiento.
      Cuerpo: Explica que según sus kilómetros, le toca una revisión pronto. Sé amable y directo.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error generating email with Gemini:", error);
    return "Error al generar el contenido del email leonino.";
  }
}

export interface MaintenanceIntervals {
  oil_change_km: number | null;
  oil_change_months: number | null;
  filter_change_km: number | null;
  tire_change_km: number | null;
  other_filters_km: number | null;
  spark_plugs_km: number | null;
  source_url?: string;
}

export interface FutureMaintenanceEvent {
  title: string;
  targetKms: number;
  remainingKms: number;
  priority: 'alta' | 'media' | 'baja';
  description: string;
}

export async function getAIMaintenanceIntervals(brand: string, model: string, year: number | string, fuelType: string): Promise<MaintenanceIntervals> {
  try {
    const prompt = `Busca en internet el manual de mantenimiento o guía de usuario oficial para el vehículo terrestre ${brand} ${model} del año ${year} (${fuelType}).
    Extrae los intervalos de mantenimiento programado oficial recomendados por el fabricante para este modelo específico.
    Es un coche/vehículo terrestre.
    Céntrate en:
    - Cambio de aceite de motor (en km y en meses)
    - Cambio de filtros de aceite o de aire (en km)
    - Rotación o cambio de neumáticos recomendada (en km)
    - Filtros de combustible, habitáculo, etc. (en km)
    - Cambio de bujías, correa o batería (en km)
    
    Genera una respuesta en formato JSON puro con la siguiente estructura exacta:
    {
      "oil_change_km": 15000,
      "oil_change_months": 12,
      "filter_change_km": 15000,
      "tire_change_km": 40000,
      "other_filters_km": 30000,
      "spark_plugs_km": 60000,
      "source_url": "URL de donde has sacado esta info o manual oficial de mantenimiento de este modelo"
    }
    
    Si una propiedad no se puede determinar tras la búsqueda, establécela en un valor numérico estimado genérico estándar de la industria propio de ${brand} en el mercado español/europeo (por ejemplo 15000 km / 12 meses de aceite) y asegúrate de que todos los campos clave tengan enteros válidos. No devuelvas ningún texto explicativo fuera del bloque JSON. Solo devuelve el JSON puro.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text from Gemini");
    }

    const data = JSON.parse(text);
    return {
      oil_change_km: Number(data.oil_change_km) || 15000,
      oil_change_months: Number(data.oil_change_months) || 12,
      filter_change_km: Number(data.filter_change_km) || 15000,
      tire_change_km: Number(data.tire_change_km) || 40000,
      other_filters_km: Number(data.other_filters_km) || 30000,
      spark_plugs_km: Number(data.spark_plugs_km) || 60000,
      source_url: data.source_url || `https://www.google.com/search?q=${encodeURIComponent(`${brand} ${model} ${year} manual mantenimiento`)}`
    };
  } catch (error) {
    console.error("Error in getAIMaintenanceIntervals:", error);
    return {
      oil_change_km: 15000,
      oil_change_months: 12,
      filter_change_km: 15000,
      tire_change_km: 40000,
      other_filters_km: 30000,
      spark_plugs_km: 60000,
      source_url: `https://www.google.com/search?q=${encodeURIComponent(`${brand} ${model} ${year} manual mantenimiento`)}`
    };
  }
}

export function calculateFutureMaintenance(
  intervals: MaintenanceIntervals,
  currentKms: number,
  lastOilChangeKms?: number,
  lastFilterChangeKms?: number,
  lastTireChangeKms?: number
): FutureMaintenanceEvent[] {
  const events: FutureMaintenanceEvent[] = [];
  
  // 1. Oil change (Cambio de aceite)
  const oilInterval = intervals.oil_change_km || 15000;
  const oilBase = lastOilChangeKms !== undefined && lastOilChangeKms !== null ? lastOilChangeKms : 0;
  let nextOilKms = oilBase + oilInterval;
  while (nextOilKms <= currentKms) {
    nextOilKms += oilInterval;
  }
  const oilRemaining = nextOilKms - currentKms;
  events.push({
    title: "Cambio de aceite",
    targetKms: nextOilKms,
    remainingKms: oilRemaining,
    priority: oilRemaining < 2000 ? 'alta' : (oilRemaining < 5000 ? 'media' : 'baja'),
    description: `Intervalo recomendado de ${oilInterval.toLocaleString()} km. ${intervals.oil_change_months ? `Se recomienda cambiar cada ${intervals.oil_change_months} meses.` : ''}`
  });

  // 2. Filters (Cambio de filtros)
  const filterInterval = intervals.filter_change_km || 15000;
  const filterBase = lastFilterChangeKms !== undefined && lastFilterChangeKms !== null ? lastFilterChangeKms : 0;
  let nextFilterKms = filterBase + filterInterval;
  while (nextFilterKms <= currentKms) {
    nextFilterKms += filterInterval;
  }
  const filterRemaining = nextFilterKms - currentKms;
  events.push({
    title: "Cambio de filtro (aceite/aire)",
    targetKms: nextFilterKms,
    remainingKms: filterRemaining,
    priority: filterRemaining < 2500 ? 'alta' : (filterRemaining < 6000 ? 'media' : 'baja'),
    description: `Filtros esenciales para el motor. Intervalo estimado cada ${filterInterval.toLocaleString()} km.`
  });

  // 3. Tires (Cambio de neumáticos)
  const tireInterval = intervals.tire_change_km || 40000;
  const tireBase = lastTireChangeKms !== undefined && lastTireChangeKms !== null ? lastTireChangeKms : 0;
  let nextTireKms = tireBase + tireInterval;
  while (nextTireKms <= currentKms) {
    nextTireKms += tireInterval;
  }
  const tireRemaining = nextTireKms - currentKms;
  events.push({
    title: "Rotación/Cambio de neumáticos",
    targetKms: nextTireKms,
    remainingKms: tireRemaining,
    priority: tireRemaining < 5000 ? 'alta' : (tireRemaining < 12000 ? 'media' : 'baja'),
    description: `Revisión recomendada de neumáticos. Intervalo cada ${tireInterval.toLocaleString()} km.`
  });

  // 4. Other Filters
  const otherInterval = intervals.other_filters_km || 30000;
  let nextOtherKms = currentKms + (otherInterval - (currentKms % otherInterval));
  if (nextOtherKms === currentKms) nextOtherKms += otherInterval;
  const otherRemaining = nextOtherKms - currentKms;
  events.push({
    title: "Filtro de combustible/habitáculo",
    targetKms: nextOtherKms,
    remainingKms: otherRemaining,
    priority: 'baja',
    description: `Mantenimiento de inyectores y polución interior. Recomendado cada ${otherInterval.toLocaleString()} km.`
  });

  // 5. Spark Plugs / Bujías
  const sparkInterval = intervals.spark_plugs_km || 60000;
  let nextSparkKms = currentKms + (sparkInterval - (currentKms % sparkInterval));
  if (nextSparkKms === currentKms) nextSparkKms += sparkInterval;
  const sparkRemaining = nextSparkKms - currentKms;
  events.push({
    title: "Cambio de Bujías",
    targetKms: nextSparkKms,
    remainingKms: sparkRemaining,
    priority: 'baja',
    description: `Reemplazo de bujías de encendido o calentadores. Recomendado cada ${sparkInterval.toLocaleString()} km.`
  });

  events.sort((a, b) => a.remainingKms - b.remainingKms);
  return events;
}

