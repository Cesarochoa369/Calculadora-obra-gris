import { GoogleGenAI, Tool } from "@google/genai";
import { GroundingChunk, MaterialItem, SupplierResult } from "../types";

// Note: Using the specific preview model requested in the prompt
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";

export const fetchMaterialPrices = async (
  materials: MaterialItem[],
  apiKey: string,
  location: string = "Argentina"
): Promise<Record<string, number> | null> => {
  if (!apiKey) {
    console.error("API Key missing");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const materialListString = materials
    .map(m => `${m.name} (${m.unit})`)
    .join(", ");

  const searchLocation = location.trim() ? location : "Argentina";

  const prompt = `
    Act as a construction cost estimator for ${searchLocation}.
    I need the current average market unit price in Argentine Pesos (ARS) for the following materials in ${searchLocation}.
    
    Materials: ${materialListString}

    Use Google Search to find current prices in this specific location if possible, otherwise use national averages.
    Return ONLY a valid JSON object where the keys are the material names provided and the values are the numeric price (no currency symbols).
    Example format: { "Hormigón H17 Elaborado": 180000, "Malla Acero Simag (15x15)": 8500 }
  `;

  try {
    const tool: Tool = { googleSearch: {} };
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        tools: [tool],
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return null;

    const pricesMap: Record<string, number> = JSON.parse(text);
    
    // Map back to IDs
    const idPriceMap: Record<string, number> = {};
    materials.forEach(m => {
        // Try to find exact match or partial match in response keys
        const key = Object.keys(pricesMap).find(k => k.includes(m.name) || m.name.includes(k));
        if (key && typeof pricesMap[key] === 'number') {
            idPriceMap[m.id] = pricesMap[key];
        }
    });

    return idPriceMap;

  } catch (error) {
    console.error("Error fetching prices:", error);
    return null;
  }
};

export const findSuppliers = async (
  systemName: string,
  apiKey: string,
  location: string = ""
): Promise<SupplierResult | null> => {
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });
  const searchLocation = location.trim() ? `in ${location}` : "in Argentina";
  
  const prompt = `Find specialized construction material suppliers ${searchLocation} specifically for the system: "${systemName}". Provide a list of 5 top suppliers with their names, locations, and a brief description.`;

  try {
     const tool: Tool = { googleSearch: {} };
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        tools: [tool]
      }
    });

    const text = response.text || "No results found.";
    
    // Extract grounding chunks
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
        .map((c: any) => c.web)
        .filter((w: any) => w && w.uri && w.title) as { title: string; uri: string }[];

    // Deduplicate sources
    const uniqueSources = Array.from(new Map(sources.map(s => [s.uri, s])).values());

    return {
      text,
      sources: uniqueSources
    };

  } catch (error) {
    console.error("Error finding suppliers:", error);
    return null;
  }
};

export const askAssistant = async (
  question: string,
  context: { system: string, inputs: any, materials: MaterialItem[] },
  apiKey: string
): Promise<string> => {
  if (!apiKey) return "Error: API Key faltante.";

  const ai = new GoogleGenAI({ apiKey });
  
  const systemContext = `
    Eres un asistente experto en construcción para una aplicación de cálculo de obra gris en Argentina.
    
    CONTEXTO DE LA APP:
    Sistema Constructivo Seleccionado: ${context.system}
    Inputs del Usuario: ${JSON.stringify(context.inputs)}
    Materiales Calculados: ${JSON.stringify(context.materials.map(m => ({ name: m.name, quantity: m.quantity, unit: m.unit, price: m.unitPrice })))}
    
    TU OBJETIVO:
    1. Ayudar al usuario a entender cómo medir sus superficies.
    2. Explicar materiales.
    3. ACLARACIÓN IMPORTANTE: Si el usuario pregunta por precios, explícale que los precios por defecto son promedios nacionales estimados. Anímalo a usar el botón "Actualizar Precios" indicando su ciudad, o a editar los precios manualmente en la tabla haciendo click en el valor.
    
    Responde de forma concisa, amable y técnica.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        { role: 'user', parts: [{ text: systemContext + "\n\nPREGUNTA DEL USUARIO: " + question }] }
      ]
    });

    return response.text || "Lo siento, no pude generar una respuesta.";
  } catch (error) {
    console.error("Error in chat:", error);
    return "Ocurrió un error al consultar al asistente.";
  }
};