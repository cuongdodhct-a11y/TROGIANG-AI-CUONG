import type { AIProvider, AIRequest } from "./types.js";
import { AIProviderUnavailableError } from "./types.js";
import { GeminiProvider } from "./providers/gemini.js";

const providers: Record<string, () => AIProvider> = {
  gemini: () => new GeminiProvider(),
};

export function getAIProvider(): AIProvider {
  const providerId = (process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
  const factory = providers[providerId];
  if (!factory) {
    throw new AIProviderUnavailableError(
      `AI_PROVIDER="${providerId}" chưa được cấu hình. Các provider hiện có: ${Object.keys(providers).join(", ")}.`,
    );
  }
  return factory();
}

export async function* streamAI(request: AIRequest): AsyncIterable<string> {
  yield* getAIProvider().stream(request);
}
