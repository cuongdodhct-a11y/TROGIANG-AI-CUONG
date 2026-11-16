export interface AIMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

export interface AIRequest {
  prompt: string;
  systemInstruction?: string;
  history: AIMessage[];
  model?: string;
}

export interface AIProvider {
  readonly id: string;
  stream(request: AIRequest): AsyncIterable<string>;
}

export class AIProviderUnavailableError extends Error {
  readonly statusCode = 503;
  constructor(message = "Nhà cung cấp AI hiện không khả dụng.") {
    super(message);
    this.name = "AIProviderUnavailableError";
  }
}
