import { getGeminiClient } from "../../gemini-server.js";
import type { AIProvider, AIRequest } from "../types.js";

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";

  async *stream(request: AIRequest): AsyncIterable<string> {
    const client = getGeminiClient();
    const contents = [
      ...request.history,
      { role: "user" as const, parts: [{ text: request.prompt }] },
    ];

    const response = await client.models.generateContentStream({
      model: request.model || process.env.GEMINI_MODEL || "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction: request.systemInstruction || undefined,
        tools: [{ googleSearch: {} }],
      },
    });

    for await (const chunk of response) {
      const text = chunk.text || "";
      if (text) yield text;
    }
  }
}
