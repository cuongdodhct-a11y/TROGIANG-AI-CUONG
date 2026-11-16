# Hybrid AI Architecture – TROGIANG-AI-CUONG

## Current implementation boundary

- The existing Gemini endpoints remain unchanged for backward compatibility.
- `POST /api/ai/chat` is the first provider-neutral streaming endpoint.
- `AI_PROVIDER=gemini` selects the current Gemini adapter. If unset, the gateway defaults to Gemini to preserve the current deployment behavior.
- Unknown providers fail explicitly with HTTP 503 through the existing safe error mapper. There is no silent provider substitution.
- This gateway currently provides text streaming only. It is not a Live-to-Live audio transport and does not yet implement local inference.

## Target Hybrid topology

1. Vercel: web application and short-lived HTTP API routes.
2. AI Gateway: provider selection, request validation, streaming, quotas and normalized errors.
3. Cloud adapters: separately configured model providers.
4. Mac Local Runtime: a separately installed service on Apple Silicon. Browser-to-local communication or an explicitly reachable secure endpoint is required; a Vercel Function cannot call the user's localhost.
5. Document RAG: Drive authorization, document export/download, DOCX/PDF/PPTX parsing, chunking, embeddings, retrieval and source citations.
6. Vietnamese Live Voice: realtime audio transport, VAD, Vietnamese STT/TTS, interruption and session lifecycle. This requires a realtime-capable service or a local runtime; it must not be simulated by ordinary SSE text streaming.

## Safety and rollout

- Keep production branch `main` unchanged.
- Develop on `feature/hybrid-ai-gateway-20261116`.
- Do not remove legacy Gemini routes until the new route is verified in Preview and the frontend migration is separately tested.
- Keep provider secrets server-side.
- Do not claim offline web research or Drive synchronization: both require network access.
- The first acceptance test is a POST to `/api/ai/chat` on Preview with a valid server-side Gemini key, checking SSE chunks and `[DONE]`.
- Then test missing key, unsupported provider, malformed payload, 429 and client disconnect behavior.
