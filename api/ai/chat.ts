import { checkRequest, parsePayload, sendError } from "../../lib/gemini-server.js";
import { streamAI } from "../../lib/ai-gateway/index.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!checkRequest(req, res)) return;

  try {
    const request = parsePayload(req.body);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    for await (const text of streamAI(request)) {
      res.write(`data: ${JSON.stringify({ text })}\\n\\n`);
    }
    res.write("data: [DONE]\\n\\n");
    return res.end();
  } catch (error: any) {
    console.error("[AI Gateway]", JSON.stringify({
      name: error?.name,
      status: error?.status,
      statusCode: error?.statusCode,
      code: error?.code,
      message: String(error?.message || "request_failed").slice(0, 300),
    }));
    return sendError(res, error);
  }
}
