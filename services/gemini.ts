
import { GoogleGenAI } from "@google/genai";

export const analyzeBrowsingTrends = async (history: any[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Extract just titles and URLs for analysis to save tokens
  const historySnippet = history.slice(0, 50).map(h => `- ${h.title} (${h.url})`).join('\n');

  const prompt = `
    Analyze this browser history and provide a short summary of the user's current interests and 3 recommended topics they might find interesting. 
    Format as JSON with keys 'summary' and 'recommendations'.
    History:
    ${historySnippet}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error('Gemini Analysis failed', error);
    return null;
  }
};
