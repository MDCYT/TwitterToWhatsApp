import dotenv from "dotenv";

dotenv.config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

export async function translateToSpanish(text) {
  if (!text || text.trim() === "") {
    return text;
  }

  if (!DEEPSEEK_API_KEY) {
    console.log("No hay DEEPSEEK_API_KEY configurada, enviando tweet sin traducir");
    return text;
  }

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "Traduce el siguiente texto al español. Mantén el tono original, no traduzcas hashtags, menciones (@usuario) ni URLs. Devuelve solo la traducción sin explicaciones.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Error API DeepSeek: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const translatedText = data.choices?.[0]?.message?.content?.trim();

    if (!translatedText) {
      throw new Error("Respuesta vacía de DeepSeek API");
    }

    return translatedText;
  } catch (error) {
    console.error("Error traduciendo texto:", error.message);
    return text;
  }
}
