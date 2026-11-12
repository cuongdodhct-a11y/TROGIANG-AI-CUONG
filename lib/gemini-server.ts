import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_PROMPT_CHARS = 12000;
const MAX_SYSTEM_CHARS = 16000;
const MAX_HISTORY_ITEMS = 20;
const MAX_HISTORY_TEXT_CHARS = 24000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;

// Best-effort per-instance throttle. Provider quotas remain the authoritative
// cross-instance protection on serverless infrastructure.
const requestWindows = new Map<string, { count: number; resetAt: number }>();
let client: GoogleGenAI | undefined;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY is not configured"), { statusCode: 503 });
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export function checkRequest(req: any, res: any): boolean {
  const ipHeader = req.headers?.["x-forwarded-for"];
  const ip = (Array.isArray(ipHeader) ? ipHeader[0] : String(ipHeader || "unknown"))
    .split(",")[0].trim().slice(0, 80);
  const now = Date.now();
  const current = requestWindows.get(ip);
  if (!current || now >= current.resetAt) {
    requestWindows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    res.setHeader("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
    res.status(429).json({ error: "Bạn gửi yêu cầu quá nhanh. Vui lòng chờ một phút rồi thử lại." });
    return false;
  }
  current.count += 1;
  return true;
}

export function parsePayload(body: any) {
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const systemInstruction = typeof body?.systemInstruction === "string" ? body.systemInstruction : "";
  const history = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY_ITEMS) : [];

  if (!prompt) throw Object.assign(new Error("Missing prompt parameter"), { statusCode: 400 });
  if (prompt.length > MAX_PROMPT_CHARS) throw Object.assign(new Error("Prompt is too long"), { statusCode: 413 });
  if (systemInstruction.length > MAX_SYSTEM_CHARS) throw Object.assign(new Error("System instruction is too long"), { statusCode: 413 });

  let historyChars = 0;
  const safeHistory = history.map((item: any) => {
    const role = item?.role === "model" ? "model" : item?.role === "user" ? "user" : null;
    const text = Array.isArray(item?.parts)
      ? item.parts.map((part: any) => typeof part?.text === "string" ? part.text : "").join("")
      : "";
    historyChars += text.length;
    if (!role || !text) throw Object.assign(new Error("Invalid conversation history"), { statusCode: 400 });
    return { role, parts: [{ text }] };
  });
  if (historyChars > MAX_HISTORY_TEXT_CHARS) throw Object.assign(new Error("Conversation history is too long"), { statusCode: 413 });

  return { prompt, systemInstruction, history: safeHistory, model: MODEL };
}

export function sendError(res: any, error: any) {
  const status = Number(error?.statusCode) || (Number(error?.status) >= 400 ? Number(error.status) : 500);
  const safeStatus = [400, 413, 429, 503].includes(status) ? status : 500;
  const message = safeStatus === 500
    ? "Dịch vụ AI tạm thời không thể xử lý yêu cầu. Vui lòng thử lại sau."
    : String(error?.message || "Request failed");
  if (!res.headersSent) res.status(safeStatus).json({ error: message });
  else {
    try { res.write(`data: ${JSON.stringify({ error: message })}\\n\\n`); res.end(); } catch {}
  }
}
