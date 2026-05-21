import { model } from '@/lib/gemini';

export async function generateMaintenanceEmail(data: any) {
  const prompt = `
  Genera un email profesional y corto.

  Usuario: ${data.name}
  Vehículo: ${data.vehicle}
  Tipo mantenimiento: ${data.type}
  Próxima fecha: ${data.date}

  El mensaje debe ser amigable y profesional.
  `;

  const result = await model.generateContent(prompt);

  return result.response.text();
}
