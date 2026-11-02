import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GoogleGenAI,
  Modality,
  LiveServerMessage,
  ActivityHandling,
  EndSensitivity,
} from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('[SERVER WARNING] GEMINI_API_KEY environment variable is not defined.');
}

const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const app = express();
app.use(express.json({ limit: '10mb' }));

// Unary generateContent endpoint with Google Search grounding & multi-turn support
app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { prompt, systemInstruction, history } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt parameter' });
    }

    const contents = Array.isArray(history) && history.length > 0
      ? [
          ...history,
          { role: 'user', parts: [{ text: prompt }] },
        ]
      : [
          { role: 'user', parts: [{ text: prompt }] },
        ];

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: systemInstruction || undefined,
        tools: [{ googleSearch: {} }],
      },
    });

    return res.json({ text: response.text || '' });
  } catch (err: any) {
    console.error('[Gemini Generate Error]:', err);
    return res.status(500).json({
      error: err?.message || 'Gemini generateContent failed',
    });
  }
});

// Streaming generateContent endpoint via SSE
app.post('/api/gemini/stream', async (req, res) => {
  try {
    const { prompt, systemInstruction, history } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt parameter' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const contents = Array.isArray(history) && history.length > 0
      ? [
          ...history,
          { role: 'user', parts: [{ text: prompt }] },
        ]
      : [
          { role: 'user', parts: [{ text: prompt }] },
        ];

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: systemInstruction || undefined,
        tools: [{ googleSearch: {} }],
      },
    });

    for await (const chunk of responseStream) {
      const text = chunk.text || '';
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('[Gemini Stream Error]:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err?.message || 'Gemini stream failed' });
    } else {
      res.write(`data: ${JSON.stringify({ error: err?.message || 'Streaming failed' })}\n\n`);
      res.end();
    }
  }
});

const server = http.createServer(app);

// WebSocket server for Gemini Live API audio streaming
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (clientWs: WebSocket) => {
  let liveSession: any = null;
  let isClosed = false;
  let isModelGenerating = false;

  clientWs.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'init') {
        const { systemInstruction, voiceName } = msg;

        try {
          liveSession = await ai.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName || 'Zephyr' } },
              },
              systemInstruction: systemInstruction || undefined,
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              contextWindowCompression: {
                slidingWindow: {},
              },
              realtimeInputConfig: {
                activityHandling: ActivityHandling.NO_INTERRUPTION,
                automaticActivityDetection: {
                  endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                  silenceDurationMs: 1000,
                },
              },
            },
            callbacks: {
              onopen: () => {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'open' }));
                }
              },
              onmessage: (message: LiveServerMessage) => {
                if (clientWs.readyState !== WebSocket.OPEN) return;

                const serverContent = message.serverContent as any;
                const inputTranscription =
                  serverContent?.inputTranscription?.text ||
                  serverContent?.inputAudioTranscription?.transcription;

                const parts: any[] = serverContent?.modelTurn?.parts || [];
                const audioChunks: string[] = [];
                let textParts = '';

                for (const part of parts) {
                  if (part?.inlineData?.data) {
                    audioChunks.push(part.inlineData.data);
                  }
                  if (part?.text && !part?.thought) {
                    textParts += (textParts ? ' ' : '') + part.text;
                  }
                }

                const outputTranscription =
                  serverContent?.outputTranscription?.text ||
                  serverContent?.outputAudioTranscription?.transcription ||
                  textParts ||
                  undefined;

                const turnComplete = !!serverContent?.turnComplete;
                const interrupted = !!serverContent?.interrupted;

                if (audioChunks.length > 0 || outputTranscription) {
                  isModelGenerating = true;
                }
                if (turnComplete || interrupted) {
                  isModelGenerating = false;
                }

                if (audioChunks.length > 0) {
                  audioChunks.forEach((audio, idx) => {
                    clientWs.send(JSON.stringify({
                      type: 'message',
                      inputTranscription: idx === 0 ? inputTranscription : undefined,
                      audio,
                      outputTranscription: idx === 0 ? outputTranscription : undefined,
                      turnComplete: idx === audioChunks.length - 1 ? turnComplete : false,
                      interrupted: false,
                    }));
                  });
                } else if (inputTranscription || outputTranscription || turnComplete || interrupted) {
                  clientWs.send(JSON.stringify({
                    type: 'message',
                    inputTranscription,
                    outputTranscription,
                    turnComplete,
                    interrupted: false,
                  }));
                }
              },
              onerror: (error: any) => {
                console.warn('[Gemini Live Session Error]:', error);
                isModelGenerating = false;
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: 'error',
                    error: String(error?.message || error || 'Live API error'),
                  }));
                }
              },
              onclose: () => {
                isModelGenerating = false;
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'close' }));
                }
              },
            },
          });
        } catch (initErr: any) {
          console.error('[Failed to initiate Gemini Live session]:', initErr);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'error',
              error: String(initErr?.message || initErr || 'Failed to start Live API session'),
            }));
          }
        }
        return;
      }

      if (msg.type === 'realtime_input' || msg.audio) {
        // Suppress mic input while the model is actively generating a turn to prevent echo self-interruption
        if (isModelGenerating) return;
        const audioBase64 = msg.audio || msg.data;
        if (liveSession && audioBase64) {
          liveSession.sendRealtimeInput({
            audio: { data: audioBase64, mimeType: 'audio/pcm;rate=16000' },
          });
        }
        return;
      }

      if (msg.type === 'client_content' && liveSession && msg.turns) {
        liveSession.send({
          clientContent: {
            turns: msg.turns,
            turnComplete: true,
          },
        });
        return;
      }

      if (msg.type === 'close') {
        isModelGenerating = false;
        if (liveSession) {
          try {
            liveSession.close();
          } catch (e) {}
          liveSession = null;
        }
        return;
      }
    } catch (parseErr) {
      console.warn('[Server WS Parse Error]:', parseErr);
    }
  });

  const cleanup = () => {
    if (isClosed) return;
    isClosed = true;
    isModelGenerating = false;
    if (liveSession) {
      try {
        liveSession.close();
      } catch (e) {}
      liveSession = null;
    }
  };

  clientWs.on('close', cleanup);
  clientWs.on('error', cleanup);
});

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
  if (pathname === '/api/live' || pathname === '/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// Configure Vite middleware in development or static serving in production
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Full-stack application running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[SERVER BOOT ERROR]:', err);
  process.exit(1);
});
