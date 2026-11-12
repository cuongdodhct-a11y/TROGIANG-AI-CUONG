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
    const result = await getGeminiClient().models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: systemInstruction || undefined,
        tools: [{ googleSearch: {} }],
      },
    });
    return res.status(200).json({ text: result.text || "" });
  } catch (error: any) {
    console.error("[Gemini Generate]", error?.status || error?.statusCode || error?.name || "request_failed");
    return sendError(res, error);
  }
}
