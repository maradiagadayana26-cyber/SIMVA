import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error generating email with Gemini:", error);
    return "Error al generar el contenido del email leonino.";
  }
}
