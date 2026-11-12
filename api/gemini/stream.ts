import { getGeminiClient, checkRequest, parsePayload, sendError } from "../../lib/gemini-server";

export const config = { maxDuration: 30 };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!checkRequest(req, res)) return;
  try {
    const { prompt, systemInstruction, history, model } = parsePayload(req.body);
    const contents = [...history, { role: "user", parts: [{ text: prompt }] }];
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const stream = await getGeminiClient().models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction: systemInstruction || undefined,
        tools: [{ googleSearch: {} }],
      },
    });
    for await (const chunk of stream) {
      const text = chunk.text || "";
      if (text) res.write(`data: ${JSON.stringify({ text })}\\n\\n`);
    }
    res.write("data: [DONE]\\n\\n");
    return res.end();
  } catch (error: any) {
    console.error("[Gemini Stream]", error?.status || error?.statusCode || error?.name || "request_failed");
    return sendError(res, error);
  }
}
