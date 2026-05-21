import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "dummy_key";
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Wrapped to support user's custom response.text() request and standard .text syntax
export const model = {
  async generateContent(prompt: string) {
    const res = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });
    
    const outputText = res.text || "";
    
    return {
      text: outputText,
      response: {
        text: () => outputText
      },
      candidates: res.candidates
    };
  }
};
